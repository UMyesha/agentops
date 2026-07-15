import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const toolCallDetailInclude = {
  step: {
    select: { id: true, order: true, role: true, agent: { select: { name: true } } },
  },
  run: {
    select: {
      id: true,
      status: true,
      workflow: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ToolCallInclude;

export type ToolCallDetail = Prisma.ToolCallGetPayload<{
  include: typeof toolCallDetailInclude;
}>;

/** One tool call with run+step breadcrumb, scoped to the owning user. */
export async function getToolCallById(
  id: string,
  userId: string
): Promise<ToolCallDetail | null> {
  return db.toolCall.findFirst({
    where: { id, run: { project: { ownerId: userId } } },
    include: toolCallDetailInclude,
  });
}
