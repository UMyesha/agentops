// Shared domain types used across the runner, tools, evals, and UI.
// These intentionally mirror the Prisma models but stay framework-agnostic so
// the agent runner can be unit-tested without a DB.

import type { ZodType } from "zod";

export type AgentRoleName =
  | "PLANNER"
  | "CODE_SEARCH"
  | "DOCUMENTATION"
  | "VALIDATOR"
  | "EVALUATOR";

// ─── MCP-style tool abstractions ─────────────────────────────────────────────

export const TOOL_NAMES = [
  "listRepoFiles",
  "readFile",
  "searchFiles",
  "getPackageJson",
  "validateOutput",
  "scoreOutput",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

/**
 * A tool carries Zod schemas so both its input and output are validated at
 * runtime by the central runTool() wrapper. (The DB `Tool` rows keep a
 * JSON-schema-ish descriptor for display; these are the executable contracts.)
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: ToolName;
  description: string;
  /** Executable contracts — validated by runTool(). */
  inputSchema: ZodType<TInput>;
  outputSchema: ZodType<TOutput>;
  /**
   * JSON Schema for the input, used as the `parameters` of an OpenAI function
   * tool (and mirroring the descriptor stored on the DB `Tool` row). Declared
   * explicitly rather than derived, to avoid a Zod→JSON-Schema converter
   * dependency and the strict-mode limitations that come with it.
   */
  jsonSchema: Record<string, unknown>;
  run: (input: TInput, ctx: ToolContext) => Promise<TOutput> | TOutput;
}

/** Passed to every tool so it can read the mock repo. */
export interface ToolContext {
  repo: MockRepo;
}

export interface ToolCallLog {
  toolName: string;
  input: unknown;
  output: unknown;
  status: "SUCCESS" | "ERROR";
  error?: string;
  latencyMs: number;
  startedAt: Date;
  completedAt: Date;
}

// ─── Mock repository fixture ─────────────────────────────────────────────────

export interface MockRepoFile {
  path: string;
  content: string;
}

export interface MockRepo {
  name: string;
  description: string;
  files: MockRepoFile[];
}

// ─── Evaluation rubric ───────────────────────────────────────────────────────

export interface RubricCriterion {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  note?: string;
}

export interface EvaluationOutcome {
  score: number; // 0–100
  result: "PASS" | "FAIL";
  rubric: RubricCriterion[];
  feedback: string;
}

// ─── Onboarding document (the workflow's final output) ───────────────────────

export interface OnboardingDoc {
  projectOverview: string;
  setupInstructions: string;
  folderStructure: string;
  keyFiles: { path: string; explanation: string }[];
  developmentWorkflow: string;
}
