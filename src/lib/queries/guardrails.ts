import { db } from "@/lib/db";
import { ownedRunWhere } from "@/lib/queries/_common";
import type { GuardrailType } from "@prisma/client";

export interface GuardrailTypeCount {
  type: GuardrailType;
  count: number;
}

export interface GuardrailRecent {
  id: string;
  runId: string;
  stepId: string | null;
  type: GuardrailType;
  message: string;
  createdAt: Date;
  workflowName: string;
  runStatus: string;
}

export interface GuardrailsView {
  total: number;
  byType: GuardrailTypeCount[];
  recent: GuardrailRecent[];
}

/** Guardrail violations grouped by type + a recent list, scoped to the user. */
export async function listGuardrails(
  userId: string
): Promise<GuardrailsView> {
  const runWhere = ownedRunWhere(userId);

  const [grouped, recent, total] = await Promise.all([
    db.guardrailViolation.groupBy({
      by: ["type"],
      where: { run: runWhere },
      _count: { _all: true },
    }),
    db.guardrailViolation.findMany({
      where: { run: runWhere },
      include: {
        run: {
          select: {
            id: true,
            status: true,
            workflow: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    db.guardrailViolation.count({ where: { run: runWhere } }),
  ]);

  return {
    total,
    byType: grouped
      .map((g) => ({ type: g.type, count: g._count._all }))
      .sort((a, b) => b.count - a.count),
    recent: recent.map((v) => ({
      id: v.id,
      runId: v.runId,
      stepId: v.stepId,
      type: v.type,
      message: v.message,
      createdAt: v.createdAt,
      workflowName: v.run.workflow.name,
      runStatus: v.run.status,
    })),
  };
}
