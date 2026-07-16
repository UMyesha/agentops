import type { ToolContext, OnboardingDoc } from "@/types";
import { onboardingDocSchema } from "@/tools/schemas";
import { scoreOnboardingDoc } from "@/evals/rubric";

/** The sections an onboarding document must contain. */
const REQUIRED_SECTIONS: (keyof OnboardingDoc)[] = [
  "projectOverview",
  "setupInstructions",
  "folderStructure",
  "keyFiles",
  "developmentWorkflow",
];

/**
 * Structural validation: does the document contain every required section,
 * non-empty? Returns a report rather than throwing — a malformed document is
 * a finding, not a tool failure.
 */
export function validateOutput(input: { document: unknown }) {
  const doc = input.document as Partial<OnboardingDoc> | null | undefined;
  if (doc == null || typeof doc !== "object") {
    return { valid: false, missingSections: REQUIRED_SECTIONS.map(String) };
  }

  const missingSections = REQUIRED_SECTIONS.filter((key) => {
    const v = doc[key];
    if (v == null) return true;
    if (typeof v === "string") return v.trim().length === 0;
    if (Array.isArray(v)) return v.length === 0;
    return false;
  }).map(String);

  return { valid: missingSections.length === 0, missingSections };
}

/**
 * Rubric scoring. Returns score + result + rubric + feedback — everything the
 * EvaluationResult row needs (feedback is NOT NULL), so the runner never has to
 * reach into tool internals to build it.
 */
export function scoreOutput(input: { document: unknown }, ctx: ToolContext) {
  const parsed = onboardingDocSchema.safeParse(input.document);
  if (!parsed.success) {
    // An unparseable document scores zero rather than crashing the evaluator.
    const outcome = scoreOnboardingDoc(
      {
        projectOverview: "",
        setupInstructions: "",
        folderStructure: "",
        keyFiles: [],
        developmentWorkflow: "",
      },
      ctx.repo
    );
    return {
      ...outcome,
      feedback: `Document did not match the expected onboarding structure. ${outcome.feedback}`,
    };
  }
  return scoreOnboardingDoc(parsed.data, ctx.repo);
}
