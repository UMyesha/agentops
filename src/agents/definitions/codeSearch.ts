import type { AgentDefinition } from "@/agents/definitions/types";
import { codeSearchOutputSchema } from "@/agents/definitions/schemas";

/** Gathers repo context using the read-only repo tools. */
export const codeSearchDefinition: AgentDefinition = {
  role: "CODE_SEARCH",
  tools: ["listRepoFiles", "getPackageJson", "readFile", "searchFiles"],
  buildInput: (state) => ({ plan: state.planner?.plan ?? [] }),
  outputSchema: codeSearchOutputSchema,
};
