import type { AgentDefinition } from "@/agents/definitions/types";
import { validatorOutputSchema } from "@/agents/definitions/schemas";

/**
 * Checks the document has every required section.
 *
 * Phase 3 note: a `valid: false` result is recorded on the step output but does
 * NOT fail the run — turning missing sections into enforcement (MISSING_SECTION
 * guardrails) is Phase 4.
 */
export const validatorDefinition: AgentDefinition = {
  role: "VALIDATOR",
  tools: ["validateOutput"],
  buildInput: (state) => ({ document: state.documentation ?? null }),
  outputSchema: validatorOutputSchema,
};
