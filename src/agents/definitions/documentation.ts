import type { AgentDefinition } from "@/agents/definitions/types";
import { documentationOutputSchema } from "@/agents/definitions/schemas";

/** Writes the onboarding document from gathered context. Uses no tools. */
export const documentationDefinition: AgentDefinition = {
  role: "DOCUMENTATION",
  tools: [],
  buildInput: (state) => ({
    context: {
      gathered: state.codeSearch?.gathered ?? [],
      findings: state.codeSearch?.findings ?? "",
    },
  }),
  outputSchema: documentationOutputSchema,
};
