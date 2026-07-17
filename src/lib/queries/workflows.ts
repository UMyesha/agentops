import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const workflowDetailInclude = {
  project: { select: { id: true, name: true, ownerId: true } },
  agents: {
    orderBy: { order: "asc" },
    include: {
      promptVersions: { orderBy: { version: "desc" } },
    },
  },
  runs: {
    include: {
      workflow: { select: { id: true, name: true } },
      evaluation: { select: { score: true, result: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  },
} satisfies Prisma.WorkflowInclude;

export type WorkflowDetail = Prisma.WorkflowGetPayload<{
  include: typeof workflowDetailInclude;
}>;

/** One workflow with ordered agents (+ prompt versions) and recent runs. */
export async function getWorkflowById(
  id: string,
  userId: string
): Promise<WorkflowDetail | null> {
  return db.workflow.findFirst({
    where: { id, project: { ownerId: userId } },
    include: workflowDetailInclude,
  });
}

// ─── Execution ───────────────────────────────────────────────────────────────

// Only what the runner needs: ordered agents plus each one's ACTIVE prompt
// version. (Deliberately does not pull run history like getWorkflowById does.)
const workflowForExecutionInclude = {
  project: { select: { id: true, ownerId: true } },
  agents: {
    orderBy: { order: "asc" },
    include: {
      promptVersions: { where: { isActive: true } },
    },
  },
} satisfies Prisma.WorkflowInclude;

export type WorkflowForExecution = Prisma.WorkflowGetPayload<{
  include: typeof workflowForExecutionInclude;
}>;

/** Load a workflow for execution, scoped to the owning user. Null if not owned. */
export async function getWorkflowForExecution(
  id: string,
  userId: string
): Promise<WorkflowForExecution | null> {
  return db.workflow.findFirst({
    where: { id, project: { ownerId: userId } },
    include: workflowForExecutionInclude,
  });
}

/** Global MCP-style tool registry (not user-scoped — tools are shared). */
export function listTools() {
  return db.tool.findMany({ orderBy: { name: "asc" } });
}

export type ToolListItem = Awaited<ReturnType<typeof listTools>>[number];
