import type { ZodType } from "zod";
import type { AgentRoleName, MockRepo, OnboardingDoc, ToolName } from "@/types";
import type { z } from "zod";
import type {
  plannerOutputSchema,
  codeSearchOutputSchema,
  validatorOutputSchema,
  evaluatorOutputSchema,
} from "@/agents/definitions/schemas";

export type PlannerOutput = z.infer<typeof plannerOutputSchema>;
export type CodeSearchOutput = z.infer<typeof codeSearchOutputSchema>;
export type ValidatorOutput = z.infer<typeof validatorOutputSchema>;
export type EvaluatorOutput = z.infer<typeof evaluatorOutputSchema>;

/**
 * Outputs accumulated as the pipeline advances. Each step's buildInput() reads
 * only what earlier steps produced; sequential execution guarantees presence,
 * but the optional types keep the compiler honest at the boundary.
 */
export interface RunState {
  request: string;
  repo: MockRepo;
  planner?: PlannerOutput;
  codeSearch?: CodeSearchOutput;
  documentation?: OnboardingDoc;
  validator?: ValidatorOutput;
  evaluator?: EvaluatorOutput;
}

export interface AgentDefinition<TIn = unknown, TOut = unknown> {
  role: AgentRoleName;
  /** Enforced allowlist — runTool rejects anything outside it. */
  tools: readonly ToolName[];
  /** Derive this step's structured input from prior outputs. */
  buildInput: (state: RunState) => TIn;
  /** Validates AND narrows the provider's `unknown` output. */
  outputSchema: ZodType<TOut>;
}
