import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/queries/_common";
import { getRunDetail } from "@/lib/queries/runs";
import {
  evaluateFinalOutput,
  upsertEvaluation,
} from "@/evals/evaluationService";
import { MOCK_REPO } from "@/agents/definitions/mock-repo";

/**
 * POST /api/runs/:id/evaluate — re-evaluate a completed run's stored output.
 *
 * Synchronous. Because the evaluation is one-to-one, this REPLACES the run's
 * single EvaluationResult (no history) via an idempotent upsert.
 *
 * 200 { runId, score, result, rubric, feedback }
 * 401 unauthenticated · 404 missing/not-owned · 422 no final output
 * 500 evaluation validation/persistence failed (existing result left intact)
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await getRunDetail(id, userId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  if (run.finalOutput == null) {
    return NextResponse.json(
      { error: "Run has no final output to evaluate" },
      { status: 422 }
    );
  }

  try {
    // upsertEvaluation validates the outcome before writing, so a failure here
    // never overwrites the existing EvaluationResult with incomplete data.
    const outcome = evaluateFinalOutput(run.finalOutput, MOCK_REPO);
    const row = await upsertEvaluation(run.id, outcome);
    return NextResponse.json({
      runId: run.id,
      score: row.score,
      result: row.result,
      rubric: row.rubric,
      feedback: row.feedback,
    });
  } catch (err) {
    console.error("[api] re-evaluation failed:", err);
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 });
  }
}
