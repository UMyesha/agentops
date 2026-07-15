import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const agentWithPromptsInclude = {
  workflow: { select: { id: true, name: true } },
  promptVersions: { orderBy: { version: "desc" } },
} satisfies Prisma.AgentInclude;

export type AgentWithPrompts = Prisma.AgentGetPayload<{
  include: typeof agentWithPromptsInclude;
}>;

/**
 * All agents the user owns (across their workflows) with their prompt versions,
 * ordered by the agent's pipeline position.
 */
export async function listPromptVersionsByAgent(
  userId: string
): Promise<AgentWithPrompts[]> {
  return db.agent.findMany({
    where: { workflow: { project: { ownerId: userId } } },
    include: agentWithPromptsInclude,
    orderBy: [{ workflowId: "asc" }, { order: "asc" }],
  });
}
