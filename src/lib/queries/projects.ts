import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

// ─── Projects list ───────────────────────────────────────────────────────────

const projectListInclude = {
  _count: { select: { workflows: true, runs: true } },
} satisfies Prisma.ProjectInclude;

export type ProjectListItem = Prisma.ProjectGetPayload<{
  include: typeof projectListInclude;
}>;

export async function listProjects(
  userId: string
): Promise<ProjectListItem[]> {
  return db.project.findMany({
    where: { ownerId: userId },
    include: projectListInclude,
    orderBy: { createdAt: "desc" },
  });
}

// ─── Project detail ──────────────────────────────────────────────────────────

const projectDetailInclude = {
  workflows: {
    include: { _count: { select: { agents: true, runs: true } } },
    orderBy: { createdAt: "asc" },
  },
  runs: {
    include: {
      workflow: { select: { id: true, name: true } },
      evaluation: { select: { score: true, result: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  },
} satisfies Prisma.ProjectInclude;

export type ProjectDetail = Prisma.ProjectGetPayload<{
  include: typeof projectDetailInclude;
}>;

/** One project with its workflows and recent runs, scoped to the owner. */
export async function getProjectById(
  id: string,
  userId: string
): Promise<ProjectDetail | null> {
  return db.project.findFirst({
    where: { id, ownerId: userId },
    include: projectDetailInclude,
  });
}
