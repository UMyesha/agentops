import { db } from "@/lib/db";
import { ownedRunWhere } from "@/lib/queries/_common";
import type { RunListItem } from "@/lib/queries/runs";

export interface DashboardMetrics {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  successRate: number | null; // 0–100, null when no runs
  avgCompletedLatencyMs: number | null;
  avgEvalScore: number | null;
  guardrailCount: number;
  retriedRunCount: number;
  activeRunCount: number;
  recentRuns: RunListItem[];
  recentErrors: {
    id: string;
    status: string;
    failureReason: string | null;
    createdAt: Date;
    workflowName: string;
  }[];
}

const runListInclude = {
  workflow: { select: { id: true, name: true } },
  evaluation: { select: { score: true, result: true } },
};

/** All dashboard roll-ups for the signed-in user, computed in a few DB calls. */
export async function getDashboardMetrics(
  userId: string
): Promise<DashboardMetrics> {
  const where = ownedRunWhere(userId);

  const [
    totalRuns,
    completedRuns,
    failedRuns,
    completedAgg,
    evalAgg,
    guardrailCount,
    retriedRunCount,
    activeRunCount,
    recentRuns,
    recentFailed,
  ] = await Promise.all([
    db.agentRun.count({ where }),
    db.agentRun.count({ where: { ...where, status: "COMPLETED" } }),
    db.agentRun.count({ where: { ...where, status: "FAILED" } }),
    db.agentRun.aggregate({
      where: { ...where, status: "COMPLETED" },
      _avg: { totalLatencyMs: true },
    }),
    db.evaluationResult.aggregate({
      where: { run: { ...where } },
      _avg: { score: true },
    }),
    // Guardrail violations across the user's runs.
    db.guardrailViolation.count({ where: { run: { ...where } } }),
    // Runs that were retried at least once (retryCount > 0 is a persisted signal).
    db.agentRun.count({ where: { ...where, retryCount: { gt: 0 } } }),
    // Runs currently in flight (queued or running).
    db.agentRun.count({
      where: { ...where, status: { in: ["QUEUED", "RUNNING"] } },
    }),
    db.agentRun.findMany({
      where,
      include: runListInclude,
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.agentRun.findMany({
      where: { ...where, status: "FAILED" },
      include: { workflow: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return {
    totalRuns,
    completedRuns,
    failedRuns,
    successRate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : null,
    avgCompletedLatencyMs: completedAgg._avg.totalLatencyMs
      ? Math.round(completedAgg._avg.totalLatencyMs)
      : null,
    avgEvalScore: evalAgg._avg.score ? Math.round(evalAgg._avg.score) : null,
    guardrailCount,
    retriedRunCount,
    activeRunCount,
    recentRuns,
    recentErrors: recentFailed.map((r) => ({
      id: r.id,
      status: r.status,
      failureReason: r.failureReason,
      createdAt: r.createdAt,
      workflowName: r.workflow.name,
    })),
  };
}
