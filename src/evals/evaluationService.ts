import { Prisma, type EvaluationResult } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { scoreFinalOutput } from "@/evals/rubric";
import { evaluatorOutputSchema } from "@/agents/definitions/schemas";
import type { EvaluationOutcome, MockRepo } from "@/types";

/**
 * Centralized evaluation service.
 *
 * Scoring goes through the single shared `scoreFinalOutput` (rubric.ts), and
 * persistence goes through one validating upsert — so the runner's Evaluator
 * agent and the re-evaluation endpoint always produce and store the same
 * structure into the one-to-one EvaluationResult.
 */

/** Pure: score a run's `finalOutput` (unknown shape) against the rubric. */
export function evaluateFinalOutput(
  finalOutput: unknown,
  repo: MockRepo
): EvaluationOutcome {
  return scoreFinalOutput(finalOutput, repo);
}

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/**
 * Validate an evaluation outcome, then upsert the run's single EvaluationResult.
 *
 * Validation happens BEFORE any write: an outcome that fails the evaluation
 * schema throws and nothing is written, so a bad re-evaluation can never
 * overwrite a good result with incomplete data.
 *
 * Throws on validation OR DB failure — it does not swallow. Fatality is the
 * caller's decision (fatal in the runner's success path; HTTP 500 in the
 * re-evaluation route).
 */
export async function upsertEvaluation(
  runId: string,
  outcome: EvaluationOutcome
): Promise<EvaluationResult> {
  const parsed = evaluatorOutputSchema.safeParse(outcome);
  if (!parsed.success) {
    throw new Error(
      `Invalid evaluation outcome for run ${runId}: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"} ${i.message}`)
        .join("; ")}`
    );
  }
  const value = parsed.data;

  // Decide the audit action by whether a result already existed.
  const existing = await db.evaluationResult.findUnique({ where: { runId } });

  const row = await db.evaluationResult.upsert({
    where: { runId },
    create: {
      runId,
      score: value.score,
      result: value.result,
      rubric: json(value.rubric),
      feedback: value.feedback,
    },
    update: {
      score: value.score,
      result: value.result,
      rubric: json(value.rubric),
      feedback: value.feedback,
    },
  });

  await logAudit({
    action: existing ? "evaluation.updated" : "evaluation.created",
    entity: "EvaluationResult",
    entityId: runId,
    metadata: { score: value.score, result: value.result },
  });

  return row;
}
