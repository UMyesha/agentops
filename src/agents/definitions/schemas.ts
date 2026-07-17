import { z } from "zod";
import { onboardingDocSchema, rubricSchema } from "@/tools/schemas";

// Output contracts per agent role. These are the type gate at the runner
// boundary: whatever a provider returns is parsed by the matching schema.

export const plannerOutputSchema = z.object({
  plan: z.array(z.string().min(1)).min(1),
});

export const codeSearchOutputSchema = z.object({
  gathered: z.array(z.string()),
  findings: z.string().min(1),
});

export const documentationOutputSchema = onboardingDocSchema;

export const validatorOutputSchema = z.object({
  valid: z.boolean(),
  missingSections: z.array(z.string()),
});

/**
 * Carries everything the EvaluationResult row needs. `feedback` is a NOT NULL
 * column and `rubric` is required, and both are produced inside the scoreOutput
 * tool — so they travel out on the step output rather than forcing the runner
 * to reach into tool internals.
 */
export const evaluatorOutputSchema = z.object({
  score: z.number().int().min(0).max(100),
  result: z.enum(["PASS", "FAIL"]),
  rubric: rubricSchema,
  feedback: z.string().min(1),
});
