import { Prisma, type RunStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { estimateCost } from "@/lib/metrics";
import { getWorkflowForExecution } from "@/lib/queries/workflows";
import { PIPELINE, type RunState } from "@/agents/definitions";
import { preflightWorkflow, type PreflightResult } from "@/agents/preflight";
import type { AgentContext, AgentProvider } from "@/agents/provider";
import { runTool } from "@/tools/registry";
import { upsertEvaluation } from "@/evals/evaluationService";
import { runGuardrails } from "@/guardrails/service";
import { classifyError } from "@/agents/errors";
import { MOCK_REPO } from "@/agents/definitions/mock-repo";
import type { AgentRoleName, OnboardingDoc } from "@/types";
import type { EvaluatorOutput } from "@/agents/definitions/types";

export class WorkflowNotFoundError extends Error {
  constructor(id: string) {
    super(`Workflow ${id} not found or not accessible.`);
    this.name = "WorkflowNotFoundError";
  }
}

const json = (v: unknown): Prisma.InputJsonValue =>
  (v === undefined ? null : v) as Prisma.InputJsonValue;

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Store a step's validated output under the right RunState key. */
function assignState(state: RunState, role: AgentRoleName, output: unknown) {
  switch (role) {
    case "PLANNER":
      state.planner = output as RunState["planner"];
      break;
    case "CODE_SEARCH":
      state.codeSearch = output as RunState["codeSearch"];
      break;
    case "DOCUMENTATION":
      state.documentation = output as OnboardingDoc;
      break;
    case "VALIDATOR":
      state.validator = output as RunState["validator"];
      break;
    case "EVALUATOR":
      state.evaluator = output as EvaluatorOutput;
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// A. Create a queued run (API path)
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateQueuedRunOptions {
  workflowId: string;
  userId: string;
  request: string;
  /** Injected in tests; otherwise resolved from AI_PROVIDER during preflight. */
  provider?: AgentProvider;
}

/**
 * Create + persist a new run as QUEUED. Preflight runs BEFORE any row is written
 * (a config error → `WorkflowConfigError` → HTTP 422, no run created). Nothing
 * is enqueued here — the caller enqueues after this returns.
 */
export async function createQueuedRun(
  opts: CreateQueuedRunOptions
): Promise<{ runId: string }> {
  const { workflowId, userId, request } = opts;

  const workflow = await getWorkflowForExecution(workflowId, userId);
  if (!workflow) throw new WorkflowNotFoundError(workflowId);

  const dbToolNames = (await db.tool.findMany({ select: { name: true } })).map(
    (t) => t.name
  );
  const { provider, agentsByRole } = preflightWorkflow({
    workflow,
    dbToolNames,
    provider: opts.provider,
  });

  const promptVersionSnapshot = PIPELINE.map((d) => ({
    role: d.role,
    promptVersion: agentsByRole.get(d.role)!.promptVersions[0].version,
  }));

  const run = await db.agentRun.create({
    data: {
      workflowId: workflow.id,
      projectId: workflow.projectId,
      triggeredById: userId,
      status: "QUEUED",
      input: json({ request, repo: MOCK_REPO.name }),
      model: provider.model,
      retryCount: 0,
      promptVersionSnapshot: json(promptVersionSnapshot),
    },
  });
  await logAudit({
    userId,
    action: "run.created",
    entity: "AgentRun",
    entityId: run.id,
    metadata: { workflowId: workflow.id, provider: provider.name },
  });

  return { runId: run.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Execute an already-persisted run (worker path)
// ─────────────────────────────────────────────────────────────────────────────

/** Discriminated outcome. executeExistingRun NEVER throws — the worker decides
 *  throw-vs-return from this (retry / retry_exhausted → throw). */
export type RunOutcome =
  | { kind: "completed"; runId: string }
  | { kind: "failed_business"; runId: string } // non-retryable terminal
  | { kind: "retry"; runId: string; retryAttempt: number; maxAttempts: number }
  | { kind: "retry_exhausted"; runId: string } // retryable, final attempt, terminal
  | { kind: "noop"; runId: string; reason: string };

export interface ExecuteExistingRunOptions {
  runId: string;
  userId: string;
  /** Bounded FAILURE-retry number = job.attemptsMade + 1. */
  retryAttempt: number;
  maxAttempts: number;
  /** Processing activation = job.attemptsStarted (++ on every activation incl. stalled). */
  activation: number;
  /**
   * Best-effort ownership check via the BullMQ lock (worker calls
   * job.extendLock(token, lockDurationMs)). Returns true if this worker still
   * owns the job; false/absent means treat as owner (test convenience). Called
   * before a trace reset and before every terminal DB write; a false result
   * aborts with no reset and no terminal write.
   */
  verifyLock?: () => Promise<boolean>;
  provider?: AgentProvider;
  /** Base delay used only for retry-audit metadata. */
  backoffMs?: number;
}

/** Raised inside the pipeline when a step fails; carries the index + cause. */
class PipelineStepError extends Error {
  constructor(
    readonly failedIndex: number,
    readonly role: AgentRoleName,
    readonly cause: unknown
  ) {
    super(messageOf(cause));
    this.name = "PipelineStepError";
  }
}

async function ownsLock(verifyLock?: () => Promise<boolean>): Promise<boolean> {
  if (!verifyLock) return true; // no fence supplied (tests / wrapper)
  try {
    return await verifyLock();
  } catch {
    return false;
  }
}

/** Delete every transient artifact from a prior attempt (idempotent). Keeps the
 *  AgentRun, its request/input, promptVersionSnapshot, and retryCount. */
async function resetTransientArtifacts(runId: string) {
  await db.$transaction([
    // RunStep delete cascades its ToolCalls (onDelete: Cascade).
    db.runStep.deleteMany({ where: { runId } }),
    db.guardrailViolation.deleteMany({ where: { runId } }),
    db.evaluationResult.deleteMany({ where: { runId } }),
    db.agentRun.update({
      where: { id: runId },
      data: {
        finalOutput: Prisma.JsonNull,
        failureReason: null,
        totalLatencyMs: null,
        estTokens: null,
        estCostUsd: null,
        completedAt: null,
      },
    }),
  ]);
}

/** Run the five-agent pipeline; on step failure marks that step FAILED and
 *  throws PipelineStepError (no run finalization here). */
async function runPipeline(params: {
  runId: string;
  userId: string;
  provider: AgentProvider;
  agentsByRole: PreflightResult["agentsByRole"];
  request: string;
  attempt: number;
}): Promise<{ state: RunState; totalTokens: number }> {
  const { runId, userId, provider, agentsByRole, request, attempt } = params;
  const repo = MOCK_REPO;
  const state: RunState = { request, repo };
  let totalTokens = 0;

  for (let i = 0; i < PIPELINE.length; i++) {
    const def = PIPELINE[i];
    const agent = agentsByRole.get(def.role)!;
    const prompt = agent.promptVersions[0];
    const input = def.buildInput(state);

    const stepStartedAt = new Date();
    const step = await db.runStep.create({
      data: {
        runId,
        agentId: agent.id,
        role: def.role,
        order: i + 1,
        status: "RUNNING",
        input: json(input),
        startedAt: stepStartedAt,
      },
    });

    try {
      const ctx: AgentContext = {
        role: def.role,
        instructions: prompt.content,
        promptVersion: prompt.version,
        model: provider.model,
        input,
        repo,
        tools: def.tools,
        attempt,
        callTool: (name, toolInput) =>
          runTool({
            name,
            input: toolInput,
            runId,
            stepId: step.id,
            repo,
            allowed: def.tools,
            userId,
          }),
      };

      const result = await provider.run(ctx);

      const parsed = def.outputSchema.safeParse(result.output);
      if (!parsed.success) {
        throw new Error(
          `${def.role} returned output that does not match its contract: ${parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`)
            .join("; ")}`
        );
      }

      const completedAt = new Date();
      await db.runStep.update({
        where: { id: step.id },
        data: {
          status: "COMPLETED",
          output: json(parsed.data),
          completedAt,
          latencyMs: completedAt.getTime() - stepStartedAt.getTime(),
          estTokens: result.estTokens,
        },
      });
      totalTokens += result.estTokens;
      assignState(state, def.role, parsed.data);
    } catch (err) {
      const failedAt = new Date();
      await db.runStep.update({
        where: { id: step.id },
        data: {
          status: "FAILED",
          error: messageOf(err),
          completedAt: failedAt,
          latencyMs: failedAt.getTime() - stepStartedAt.getTime(),
        },
      });
      throw new PipelineStepError(i, def.role, err);
    }
  }

  return { state, totalTokens };
}

/** Mark downstream steps SKIPPED after a terminal failure at `failedIndex`. */
async function writeSkippedSteps(
  runId: string,
  failedIndex: number,
  agentsByRole: PreflightResult["agentsByRole"]
) {
  for (let j = failedIndex + 1; j < PIPELINE.length; j++) {
    const skipped = PIPELINE[j];
    await db.runStep.create({
      data: {
        runId,
        agentId: agentsByRole.get(skipped.role)!.id,
        role: skipped.role,
        order: j + 1,
        status: "SKIPPED",
        input: json({}),
      },
    });
  }
}

/**
 * Execute an already-persisted run. Loads authoritative data from Postgres,
 * claims QUEUED-or-stale-RUNNING (best-effort ownership: BullMQ lock + status
 * transition, NOT a strict fence), optionally resets a prior attempt, runs the
 * pipeline, and finalizes. Never throws — returns a RunOutcome the worker maps.
 */
export async function executeExistingRun(
  opts: ExecuteExistingRunOptions
): Promise<RunOutcome> {
  const { runId, userId, retryAttempt, maxAttempts, activation, verifyLock } =
    opts;
  const noop = (reason: string): RunOutcome => ({ kind: "noop", runId, reason });

  try {
    // 1. Load — owner-scoped.
    const existing = await db.agentRun.findFirst({
      where: { id: runId, project: { ownerId: userId } },
      select: { status: true, workflowId: true, input: true },
    });
    if (!existing) return noop("run not found or not owned");

    // 2. Terminal no-op (duplicate delivery of a finished run).
    if (existing.status === "COMPLETED" || existing.status === "FAILED") {
      return noop(`already terminal (${existing.status})`);
    }

    // 3. Load workflow + preflight (re-resolve provider/agents).
    const workflow = await getWorkflowForExecution(existing.workflowId, userId);
    if (!workflow) {
      return await finalizeFailed({
        runId,
        userId,
        reason: "Workflow not found or not accessible at execution time.",
        model: "unknown",
        verifyLock,
        kind: "failed_business",
      });
    }
    const dbToolNames = (
      await db.tool.findMany({ select: { name: true } })
    ).map((t) => t.name);

    let pre: PreflightResult;
    try {
      pre = preflightWorkflow({ workflow, dbToolNames, provider: opts.provider });
    } catch (err) {
      return await finalizeFailed({
        runId,
        userId,
        reason: `Preflight failed: ${messageOf(err)}`,
        model: "unknown",
        verifyLock,
        kind: "failed_business",
      });
    }
    const { provider, agentsByRole } = pre;

    // 4. Atomic claim (QUEUED or stale RUNNING). Best-effort ownership only.
    const startedAt = new Date();
    const claim = await db.agentRun.updateMany({
      where: { id: runId, status: { in: ["QUEUED", "RUNNING"] } },
      data: { status: "RUNNING", startedAt },
    });
    if (claim.count !== 1) return noop("could not claim (concurrent/terminal)");
    await logAudit({
      userId,
      action: "run.worker_started",
      entity: "AgentRun",
      entityId: runId,
      metadata: { retryAttempt, activation },
    });

    // 5. Reset the prior attempt's artifacts if this is a re-attempt. Verify the
    //    BullMQ lock first — a lost lock means a newer activation owns the run,
    //    so we must NOT reset.
    const isReattempt =
      retryAttempt > 1 || existing.status === "RUNNING" || activation > 1;
    if (isReattempt) {
      if (!(await ownsLock(verifyLock))) return noop("lock lost before reset");
      await resetTransientArtifacts(runId);
    }

    const request =
      (existing.input as { request?: string } | null)?.request ?? "";

    // 6. Run the pipeline.
    let pipeline: { state: RunState; totalTokens: number };
    try {
      pipeline = await runPipeline({
        runId,
        userId,
        provider,
        agentsByRole,
        request,
        attempt: retryAttempt,
      });
    } catch (err) {
      if (!(err instanceof PipelineStepError)) throw err;
      const classification = classifyError(err.cause);
      const message = messageOf(err.cause);

      // Retryable with attempts remaining → back to QUEUED, let BullMQ retry.
      if (classification === "retryable" && retryAttempt < maxAttempts) {
        await db.agentRun.update({
          where: { id: runId },
          data: { status: "QUEUED", retryCount: retryAttempt },
        });
        await logAudit({
          userId,
          action: "run.retry_scheduled",
          entity: "AgentRun",
          entityId: runId,
          metadata: {
            retryAttempt,
            maxAttempts,
            reason: message,
            nextDelayMs: opts.backoffMs,
          },
        });
        return { kind: "retry", runId, retryAttempt, maxAttempts };
      }

      // Terminal FAILED (non-retryable, or retryable but exhausted). Token
      // roll-up isn't meaningful for a failed run, so report 0.
      await writeSkippedSteps(runId, err.failedIndex, agentsByRole);
      return await finalizeFailed({
        runId,
        userId,
        reason: `${err.role} step failed: ${message}`,
        model: provider.model,
        startedAt,
        totalTokens: 0,
        verifyLock,
        kind:
          classification === "retryable" ? "retry_exhausted" : "failed_business",
      });
    }

    const { state, totalTokens } = pipeline;
    const finalOutput = json(state.documentation);
    const evaluation = state.evaluator!;

    // 7. Evaluation is REQUIRED for COMPLETED (Phase 4 guarantee). A failure is
    //    a non-retryable terminal — but the produced document is preserved as
    //    finalOutput so guardrails don't misread it as EMPTY_OUTPUT.
    try {
      await upsertEvaluation(runId, evaluation);
    } catch (err) {
      return await finalizeFailed({
        runId,
        userId,
        reason: `Evaluation persistence failed: ${messageOf(err)}`,
        model: provider.model,
        startedAt,
        totalTokens,
        finalOutput,
        verifyLock,
        kind: "failed_business",
      });
    }

    // 8. Complete — verify lock before the terminal write.
    if (!(await ownsLock(verifyLock))) return noop("lock lost before completion");
    const completedAt = new Date();
    await db.agentRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        finalOutput,
        completedAt,
        totalLatencyMs: completedAt.getTime() - startedAt.getTime(),
        estTokens: totalTokens,
        estCostUsd: estimateCost(provider.model, totalTokens),
      },
    });
    await logAudit({
      userId,
      action: "run.worker_completed",
      entity: "AgentRun",
      entityId: runId,
      metadata: { score: evaluation.score, result: evaluation.result },
    });
    await finalizeGuardrails(runId, userId);
    return { kind: "completed", runId };
  } catch (err) {
    // Truly unexpected error (not a pipeline step). Do not retry an unclassified
    // failure — mark FAILED best-effort and return terminal.
    console.error("[runner] unexpected executeExistingRun error:", err);
    return await finalizeFailed({
      runId,
      userId,
      reason: `Unexpected worker error: ${messageOf(err)}`,
      model: "unknown",
      verifyLock,
      kind: "failed_business",
    }).catch(() => noop("unexpected error, finalize failed"));
  }
}

/** Shared terminal-FAILED finalizer with lock-fenced terminal write. */
async function finalizeFailed(params: {
  runId: string;
  userId: string;
  reason: string;
  model: string;
  startedAt?: Date;
  totalTokens?: number;
  finalOutput?: Prisma.InputJsonValue;
  verifyLock?: () => Promise<boolean>;
  kind: "failed_business" | "retry_exhausted";
}): Promise<RunOutcome> {
  const {
    runId,
    userId,
    reason,
    model,
    startedAt,
    totalTokens = 0,
    finalOutput,
    verifyLock,
    kind,
  } = params;

  if (!(await ownsLock(verifyLock))) {
    return { kind: "noop", runId, reason: "lock lost before terminal write" };
  }

  const completedAt = new Date();
  await db.agentRun.update({
    where: { id: runId },
    data: {
      status: "FAILED",
      failureReason: reason,
      ...(finalOutput !== undefined ? { finalOutput } : {}),
      completedAt,
      totalLatencyMs: startedAt
        ? completedAt.getTime() - startedAt.getTime()
        : undefined,
      estTokens: totalTokens,
      estCostUsd: estimateCost(model, totalTokens),
    },
  });
  await logAudit({
    userId,
    action: "run.worker_failed",
    entity: "AgentRun",
    entityId: runId,
    metadata: { reason },
  });
  await finalizeGuardrails(runId, userId);
  return { kind, runId };
}

/** Run the guardrail engine at finalization. Non-fatal (defense in depth). */
async function finalizeGuardrails(runId: string, userId: string) {
  try {
    await runGuardrails({ runId, userId });
  } catch (err) {
    console.error("[guardrails] non-fatal failure at finalization:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// C. Back-compat wrapper — create + execute in one call (tests only)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecuteRunOptions {
  workflowId: string;
  userId: string;
  request: string;
  provider?: AgentProvider;
}

export interface ExecuteRunResult {
  runId: string;
  status: Extract<RunStatus, "COMPLETED" | "FAILED">;
}

/**
 * Convenience wrapper preserved for the existing lifecycle tests: create a
 * QUEUED run then execute it once (attempt 1, no retries, no lock fence).
 * Production uses createQueuedRun (API) + executeExistingRun (worker) directly.
 */
export async function executeWorkflowRun(
  opts: ExecuteRunOptions
): Promise<ExecuteRunResult> {
  const { runId } = await createQueuedRun(opts);
  const outcome = await executeExistingRun({
    runId,
    userId: opts.userId,
    retryAttempt: 1,
    maxAttempts: 1,
    activation: 1,
    provider: opts.provider,
  });
  return {
    runId,
    status: outcome.kind === "completed" ? "COMPLETED" : "FAILED",
  };
}
