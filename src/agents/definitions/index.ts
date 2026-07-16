import type { AgentRoleName } from "@/types";
import type { AgentDefinition } from "@/agents/definitions/types";
import { plannerDefinition } from "@/agents/definitions/planner";
import { codeSearchDefinition } from "@/agents/definitions/codeSearch";
import { documentationDefinition } from "@/agents/definitions/documentation";
import { validatorDefinition } from "@/agents/definitions/validator";
import { evaluatorDefinition } from "@/agents/definitions/evaluator";

/** The Repository Onboarding pipeline, in execution order. */
export const PIPELINE: readonly AgentDefinition[] = [
  plannerDefinition,
  codeSearchDefinition,
  documentationDefinition,
  validatorDefinition,
  evaluatorDefinition,
] as const;

/** Roles the pipeline requires, in order — used by preflight validation. */
export const REQUIRED_ROLES: readonly AgentRoleName[] = PIPELINE.map(
  (d) => d.role
);

export function getDefinition(role: AgentRoleName): AgentDefinition | undefined {
  return PIPELINE.find((d) => d.role === role);
}

export * from "@/agents/definitions/types";
