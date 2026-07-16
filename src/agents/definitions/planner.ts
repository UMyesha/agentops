import type { AgentDefinition } from "@/agents/definitions/types";
import { plannerOutputSchema } from "@/agents/definitions/schemas";

/** Breaks the onboarding request into an ordered plan. Uses no tools. */
export const plannerDefinition: AgentDefinition = {
  role: "PLANNER",
  tools: [],
  buildInput: (state) => ({
    request: state.request,
    repo: state.repo.name,
  }),
  outputSchema: plannerOutputSchema,
};
