// Shared domain types used across the runner, tools, evals, and UI.
// These intentionally mirror the Prisma models but stay framework-agnostic so
// the agent runner (Phase 3) can be unit-tested without a DB.

export type AgentRoleName =
  | "PLANNER"
  | "CODE_SEARCH"
  | "DOCUMENTATION"
  | "VALIDATOR"
  | "EVALUATOR";

// ─── MCP-style tool abstractions ─────────────────────────────────────────────

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  /** JSON-schema-ish shape (also stored in the DB Tool.inputSchema). */
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  run: (input: TInput, ctx: ToolContext) => Promise<TOutput> | TOutput;
}

/** Passed to every tool so it can read the mock repo (and, later, log). */
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
