import { db } from "@/lib/db";
import { ownedRunWhere } from "@/lib/queries/_common";
import type { RubricCriterion } from "@/types";

const LOW_SCORE_THRESHOLD = 70;

export interface EvaluationHistoryItem {
  id: string;
  runId: string;
  score: number;
  result: string;
  feedback: string;
  createdAt: Date;
  workflowName: string;
  runStatus: string;
  failedCriteria: string[];
}

export interface EvaluationsView {
  avgScore: number | null;
  count: number;
  passRate: number | null;
  evaluations: EvaluationHistoryItem[];
  lowScoring: EvaluationHistoryItem[];
}

function failedCriteria(rubric: unknown): string[] {
  if (!Array.isArray(rubric)) return [];
  return (rubric as RubricCriterion[])
    .filter((c) => c && c.passed === false)
    .map((c) => c.label);
}

/** Evaluation history + roll-ups for the signed-in user. */
export async function listEvaluations(
  userId: string
): Promise<EvaluationsView> {
  const runWhere = ownedRunWhere(userId);

  const [agg, rows] = await Promise.all([
    db.evaluationResult.aggregate({
      where: { run: runWhere },
      _avg: { score: true },
      _count: true,
    }),
    db.evaluationResult.findMany({
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
    }),
  ]);

  const passCount = rows.filter((r) => r.result === "PASS").length;

  const evaluations: EvaluationHistoryItem[] = rows.map((r) => ({
    id: r.id,
    runId: r.runId,
    score: r.score,
    result: r.result,
    feedback: r.feedback,
    createdAt: r.createdAt,
    workflowName: r.run.workflow.name,
    runStatus: r.run.status,
    failedCriteria: failedCriteria(r.rubric),
  }));

  return {
    avgScore: agg._avg.score != null ? Math.round(agg._avg.score) : null,
    count: agg._count,
    passRate:
      rows.length > 0 ? Math.round((passCount / rows.length) * 100) : null,
    evaluations,
    lowScoring: evaluations.filter((e) => e.score < LOW_SCORE_THRESHOLD),
  };
}
