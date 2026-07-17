import type { AgentDefinition } from "@/agents/definitions/types";
import { evaluatorOutputSchema } from "@/agents/definitions/schemas";

/** Scores the document against the rubric; output feeds EvaluationResult. */
export const evaluatorDefinition: AgentDefinition = {
  role: "EVALUATOR",
  tools: ["scoreOutput"],
  buildInput: (state) => ({ document: state.documentation ?? null }),
  outputSchema: evaluatorOutputSchema,
};
