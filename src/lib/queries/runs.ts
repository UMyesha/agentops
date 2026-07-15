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
