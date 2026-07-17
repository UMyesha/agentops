import type { AgentRoleName, MockRepo, ToolName } from "@/types";

/**
 * What an agent sees when it runs. `callTool` is injected by the runner and is
 * already bound to the current run/step and the agent's tool allowlist — so
 * providers *call* tools while the runner *persists* them. No provider ever
 * touches Prisma.
 */
export interface AgentContext {
  role: AgentRoleName;
  /** Active PromptVersion.content loaded from the database. */
  instructions: string;
  promptVersion: number;
  model: string;
  input: unknown;
  repo: MockRepo;
  /** Tools this agent may call (already enforced inside callTool). */
  tools: readonly ToolName[];
  callTool: (name: string, input: unknown) => Promise<unknown>;
}

export interface AgentResult {
  /**
   * Deliberately `unknown`. A generic `TOut` here would be unsound — it isn't
   * inferable from the argument, so the caller would pick a type the provider
   * cannot honour (an LLM returns arbitrary JSON). The role's Zod outputSchema
   * is the type gate: the runner parses this value, which both validates and
   * narrows it.
   */
  output: unknown;
  estTokens: number;
}

export interface AgentProvider {
  readonly name: "mock" | "openai";
  readonly model: string;
  run(ctx: AgentContext): Promise<AgentResult>;
}
