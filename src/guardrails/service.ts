import { Prisma, type GuardrailType } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { MOCK_REPO } from "@/agents/definitions/mock-repo";
import {
  deriveViolations,
  type CandidateViolation,
  type TraceSnapshot,
} from "@/guardrails/rules";
import type { AgentRoleName } from "@/types";

export interface GuardrailRunSummary {
  created: number;
  total: number;
  skipped: boolean;
}

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/** Stable dedup fingerprint — type + step + deterministic message. */
function fingerprint(v: {
  type: string;
  stepId: string | null;
  message: string;
}): string {
  return `${v.type}|${v.stepId ?? ""}|${v.message}`;
}

/**
 * Run the guardrail engine over a run's persisted trace and persist any new
 * violations.
 *
 * Idempotent: it recomputes the full candidate set every time and only creates
 * violations whose fingerprint isn't already stored, so re-running never
 * duplicates rows.
 *
 * Non-fatal: this never throws. A load, persist, or audit failure is logged and
 * swallowed — guardrail analysis must never crash the run it observes. (The
 * runner also wraps the call defensively.)
 */
export async function runGuardrails(params: {
  runId: string;
  userId?: string | null;
}): Promise<GuardrailRunSummary> {
  const { runId, userId } = params;

  try {
    // The runner calls this for a run it just created and owns, so the runId is
    // trusted; we load exactly the snapshot fields directly.
    const loaded = await loadRunSnapshot(runId);
    if (!loaded) return { created: 0, total: 0, skipped: true };

    const snapshot: TraceSnapshot = {
      run: { status: loaded.status, finalOutput: loaded.finalOutput },
      steps: loaded.steps.map((s) => ({
        role: s.role as AgentRoleName,
        status: s.status,
        error: s.error,
      })),
      toolCalls: loaded.steps.flatMap((s) =>
        s.toolCalls.map((tc) => ({
          stepId: tc.stepId,
          toolName: tc.toolName,
          status: tc.status,
          error: tc.error,
        }))
      ),
      repo: MOCK_REPO,
    };

    const candidates = deriveViolations(snapshot);

    // Dedup against violations already stored for this run.
    const existing = new Set(loaded.guardrails.map(fingerprint));
    const fresh = candidates.filter((c) => !existing.has(fingerprint(c)));

    if (fresh.length > 0) {
      await persist(runId, fresh);
      for (const v of fresh) {
        await logAudit({
          userId,
          action: "guardrail.violation_created",
          entity: "GuardrailViolation",
          entityId: runId,
          metadata: { type: v.type, stepId: v.stepId },
        });
      }
    }

    await logAudit({
      userId,
      action: "guardrails.completed",
      entity: "AgentRun",
      entityId: runId,
      metadata: { created: fresh.length, total: candidates.length },
    });

    return { created: fresh.length, total: candidates.length, skipped: false };
  } catch (err) {
    console.error("[guardrails] non-fatal failure for run", runId, err);
    return { created: 0, total: 0, skipped: true };
  }
}

/** Persist fresh violations; a write failure is swallowed (non-fatal). */
async function persist(runId: string, fresh: CandidateViolation[]) {
  try {
    await db.guardrailViolation.createMany({
      data: fresh.map((v) => ({
        runId,
        stepId: v.stepId,
        type: v.type as GuardrailType,
        message: v.message,
        details: json(v.details),
      })),
    });
  } catch (err) {
    console.error("[guardrails] persistence failed for run", runId, err);
  }
}

// Narrow fetch of exactly the snapshot fields the rules need.
async function loadRunSnapshot(runId: string) {
  return db.agentRun.findUnique({
    where: { id: runId },
    select: {
      status: true,
      finalOutput: true,
      steps: {
        orderBy: { order: "asc" },
        select: {
          role: true,
          status: true,
          error: true,
          toolCalls: {
            select: { stepId: true, toolName: true, status: true, error: true },
          },
        },
      },
      guardrails: { select: { type: true, stepId: true, message: true } },
    },
  });
}
