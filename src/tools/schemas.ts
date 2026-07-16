import { z } from "zod";

// Zod contracts for every MCP-style tool. runTool() validates input before
// execution and output after, so a malformed call never reaches the DB
// un-flagged and a malformed result never reaches an agent.

// ─── Shared ──────────────────────────────────────────────────────────────────

export const onboardingDocSchema = z.object({
  projectOverview: z.string(),
  setupInstructions: z.string(),
  folderStructure: z.string(),
  keyFiles: z.array(
    z.object({ path: z.string(), explanation: z.string() })
  ),
  developmentWorkflow: z.string(),
});

/** Must match the RubricCriterion shape the Phase 2 EvaluationPanel renders. */
export const rubricCriterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  weight: z.number(),
  passed: z.boolean(),
  note: z.string().optional(),
});

export const rubricSchema = z.array(rubricCriterionSchema);

// ─── listRepoFiles ───────────────────────────────────────────────────────────

export const listRepoFilesInput = z.object({});
export const listRepoFilesOutput = z.object({ files: z.array(z.string()) });

// ─── readFile ────────────────────────────────────────────────────────────────

export const readFileInput = z.object({ path: z.string().min(1) });
export const readFileOutput = z.object({
  path: z.string(),
  content: z.string(),
});

// ─── searchFiles ─────────────────────────────────────────────────────────────

export const searchFilesInput = z.object({ query: z.string().min(1) });
export const searchFilesOutput = z.object({
  matches: z.array(z.object({ path: z.string(), snippet: z.string() })),
});

// ─── getPackageJson ──────────────────────────────────────────────────────────

export const getPackageJsonInput = z.object({});
export const getPackageJsonOutput = z.record(z.unknown());

// ─── validateOutput ──────────────────────────────────────────────────────────

export const validateOutputInput = z.object({ document: z.unknown() });
export const validateOutputOutput = z.object({
  valid: z.boolean(),
  missingSections: z.array(z.string()),
});

// ─── scoreOutput ─────────────────────────────────────────────────────────────

export const scoreOutputInput = z.object({ document: z.unknown() });
/** Carries everything EvaluationResult needs (feedback is a NOT NULL column). */
export const scoreOutputOutput = z.object({
  score: z.number().int().min(0).max(100),
  result: z.enum(["PASS", "FAIL"]),
  rubric: rubricSchema,
  feedback: z.string().min(1),
});
