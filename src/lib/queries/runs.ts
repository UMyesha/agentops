import { Prisma, type RunStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ownedRunWhere } from "@/lib/queries/_common";

// ─── Run Detail (the trace timeline) ─────────────────────────────────────────

// Full include shape for the Run Detail page: steps (ordered) → each step's
// agent + tool calls (ordered), plus evaluation, guardrails, and workflow.
const runDetailInclude = {
  workflow: { select: { id: true, name: true, projectId: true } },
  steps: {
    orderBy: { order: "asc" },
    include: {
      agent: { select: { id: true, name: true, role: true } },
      toolCalls: { orderBy: { startedAt: "asc" } },
    },
  },
  evaluation: true,
  guardrails: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.AgentRunInclude;

export type RunDetail = Prisma.AgentRunGetPayload<{
  include: typeof runDetailInclude;
}>;

export type RunDetailStep = RunDetail["steps"][number];
export type RunDetailToolCall = RunDetailStep["toolCalls"][number];

/** Load one run with its full trace, scoped to the owning user. Null if not found. */
export async function getRunDetail(
  id: string,
  userId: string
): Promise<RunDetail | null> {
  return db.agentRun.findFirst({
    where: { id, ...ownedRunWhere(userId) },
    include: runDetailInclude,
  });
}

// ─── Run audit trail (retry history) ─────────────────────────────────────────

// Execution-lifecycle actions shown in the run's retry-history strip.
const AUDIT_TRAIL_ACTIONS = [
  "run.queued",
  "run.enqueue_failed",
  "run.worker_started",
  "run.retry_scheduled",
  "run.worker_completed",
  "run.worker_failed",
];

export interface RunAuditEntry {
  id: string;
  action: string;
  createdAt: Date;
  metadata: unknown;
}

/**
 * Ordered execution/retry audit trail for one run, scoped to the owning user.
 * Returns [] when the run is missing or not owned (never leaks other users' logs).
 */
export async function getRunAuditTrail(
  runId: string,
  userId: string
): Promise<RunAuditEntry[]> {
  // Ownership fence: only proceed if this user owns the run.
  const owned = await db.agentRun.findFirst({
    where: { id: runId, ...ownedRunWhere(userId) },
    select: { id: true },
  });
  if (!owned) return [];

  const rows = await db.auditLog.findMany({
    where: {
      entity: "AgentRun",
      entityId: runId,
      action: { in: AUDIT_TRAIL_ACTIONS },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, action: true, createdAt: true, metadata: true },
  });
  return rows;
}

/**
 * Read the persisted `retryable` signal (if any) from the most recent
 * `run.worker_failed` audit entry. Undefined when no such signal was recorded —
 * callers must NOT infer retryability from its absence.
 */
export function retryableSignalFrom(
  trail: RunAuditEntry[]
): boolean | undefined {
  for (let i = trail.length - 1; i >= 0; i--) {
    const entry = trail[i];
    if (entry.action !== "run.worker_failed") continue;
    const meta = entry.metadata;
    if (meta && typeof meta === "object" && "retryable" in meta) {
      const value = (meta as { retryable?: unknown }).retryable;
      if (typeof value === "boolean") return value;
    }
    return undefined;
  }
  return undefined;
}

// ─── Runs list ───────────────────────────────────────────────────────────────

const runListInclude = {
  workflow: { select: { id: true, name: true } },
  evaluation: { select: { score: true, result: true } },
} satisfies Prisma.AgentRunInclude;

export type RunListItem = Prisma.AgentRunGetPayload<{
  include: typeof runListInclude;
}>;

/** List all runs the user owns, newest first, optionally filtered by status. */
export async function listRuns(
  userId: string,
  opts: { status?: RunStatus } = {}
): Promise<RunListItem[]> {
  return db.agentRun.findMany({
    where: {
      ...ownedRunWhere(userId),
      ...(opts.status ? { status: opts.status } : {}),
    },
    include: runListInclude,
    orderBy: { createdAt: "desc" },
  });
}
