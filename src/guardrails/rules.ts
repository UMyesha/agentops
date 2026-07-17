import type {
  AgentRoleName,
  GuardrailTypeName,
  MockRepo,
  OnboardingDoc,
} from "@/types";
import { onboardingDocSchema } from "@/tools/schemas";
import { REQUIRED_SECTIONS } from "@/tools/impl/outputTools";

// Pure, deterministic guardrail rules over a persisted-trace snapshot. No DB
// access — the service (service.ts) loads the snapshot and persists results.

export interface TraceSnapshot {
  run: { status: string; finalOutput: unknown };
  steps: { role: AgentRoleName; status: string; error: string | null }[];
  toolCalls: {
    stepId: string;
    toolName: string;
    status: string;
    error: string | null;
  }[];
  repo: MockRepo;
}

export interface CandidateViolation {
  type: GuardrailTypeName;
  stepId: string | null;
  /** Deterministic — also the dedup fingerprint component. */
  message: string;
  details: Record<string, unknown>;
}

/** Minimum meaningful documentation length (all sections combined). */
export const MIN_DOC_LENGTH = 400;

// A FAILED step whose error came from the runner's output-contract check.
const CONTRACT_VIOLATION = /does not match its contract/i;

// Deterministic unsafe-content patterns (secrets + destructive commands).
const UNSAFE_PATTERNS: { category: string; re: RegExp }[] = [
  { category: "private_key", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { category: "openai_key", re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { category: "github_token", re: /\bghp_[A-Za-z0-9]{36}\b/ },
  { category: "aws_key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { category: "destructive_rm", re: /rm\s+-rf\s+\/(?:\s|$)/ },
  { category: "destructive_sql", re: /\bDROP\s+(?:DATABASE|TABLE)\b/i },
  { category: "destructive_mkfs", re: /\bmkfs\b/ },
  { category: "fork_bomb", re: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/ },
  { category: "chmod_root", re: /chmod\s+-?R?\s*777\s+\// },
];

function docText(doc: OnboardingDoc): string {
  return [
    doc.projectOverview,
    doc.setupInstructions,
    doc.folderStructure,
    doc.developmentWorkflow,
    ...doc.keyFiles.map((f) => `${f.path} ${f.explanation}`),
  ].join(" ");
}

function isEmptyDoc(doc: OnboardingDoc): boolean {
  const strings = [
    doc.projectOverview,
    doc.setupInstructions,
    doc.folderStructure,
    doc.developmentWorkflow,
  ];
  return strings.every((s) => !s || s.trim().length === 0) && doc.keyFiles.length === 0;
}

/**
 * Derive every guardrail violation for a run from its persisted trace.
 * Called on both completed and failed runs; each rule states its own scope.
 */
export function deriveViolations(snap: TraceSnapshot): CandidateViolation[] {
  const out: CandidateViolation[] = [];
  const { run, steps, toolCalls, repo } = snap;

  // ── TOOL_FAILURE — any errored tool call (both run types) ─────────────────
  for (const tc of toolCalls) {
    if (tc.status === "ERROR") {
      out.push({
        type: "TOOL_FAILURE",
        stepId: tc.stepId,
        message: `Tool ${tc.toolName} failed: ${tc.error ?? "unknown error"}`,
        details: { toolName: tc.toolName, error: tc.error },
      });
    }
  }

  // ── SKIPPED_STEP — one summary violation for the run (failed runs) ────────
  const skippedRoles = steps.filter((s) => s.status === "SKIPPED").map((s) => s.role);
  if (skippedRoles.length > 0) {
    out.push({
      type: "SKIPPED_STEP",
      stepId: null,
      message: `Downstream steps skipped: ${skippedRoles.join(", ")}.`,
      details: { skippedRoles },
    });
  }

  // ── MALFORMED_OUTPUT — failed step from a contract violation (both) ───────
  for (const s of steps) {
    if (s.status === "FAILED" && s.error && CONTRACT_VIOLATION.test(s.error)) {
      out.push({
        type: "MALFORMED_OUTPUT",
        stepId: null,
        message: `${s.role} produced output that failed its schema.`,
        details: { role: s.role, error: s.error },
      });
    }
  }

  // ── Final-output checks ───────────────────────────────────────────────────
  const finalOutput = run.finalOutput;

  if (finalOutput == null) {
    // EMPTY_OUTPUT — no final output at all (typically a failed run).
    out.push({
      type: "EMPTY_OUTPUT",
      stepId: null,
      message: "Run produced no final output.",
      details: { reason: "null" },
    });
    return out; // nothing more to check without a document
  }

  const parsed = onboardingDocSchema.safeParse(finalOutput);

  if (!parsed.success) {
    // MALFORMED_OUTPUT — a present final output that isn't a valid document.
    out.push({
      type: "MALFORMED_OUTPUT",
      stepId: null,
      message: "Final output does not match the onboarding document schema.",
      details: {
        where: "finalOutput",
        issues: parsed.error.issues.map(
          (i) => `${i.path.join(".") || "(root)"} ${i.message}`
        ),
      },
    });
    return out; // structural checks below need a valid document
  }

  const doc = parsed.data;

  // EMPTY_OUTPUT — a valid but entirely empty document.
  if (isEmptyDoc(doc)) {
    out.push({
      type: "EMPTY_OUTPUT",
      stepId: null,
      message: "Final output document has no meaningful content.",
      details: { reason: "empty_sections" },
    });
  }

  // MISSING_SECTION — required sections absent/empty.
  const missingSections = REQUIRED_SECTIONS.filter((key) => {
    const v = doc[key];
    if (v == null) return true;
    if (typeof v === "string") return v.trim().length === 0;
    if (Array.isArray(v)) return v.length === 0;
    return false;
  }).map(String);
  if (missingSections.length > 0) {
    out.push({
      type: "MISSING_SECTION",
      stepId: null,
      message: `Onboarding document is missing sections: ${missingSections.join(", ")}.`,
      details: { missingSections },
    });
  }

  // TOO_SHORT — below the justified minimum length.
  const length = docText(doc).length;
  if (length < MIN_DOC_LENGTH) {
    out.push({
      type: "TOO_SHORT",
      stepId: null,
      message: `Documentation is too short (${length} chars < ${MIN_DOC_LENGTH}).`,
      details: { length, threshold: MIN_DOC_LENGTH },
    });
  }

  // UNSUPPORTED_CLAIM — repo-verifiable file claims only (see scope note).
  const repoPaths = new Set(repo.files.map((f) => f.path));
  for (const f of doc.keyFiles) {
    if (!repoPaths.has(f.path)) {
      out.push({
        type: "UNSUPPORTED_CLAIM",
        stepId: null,
        message: `Cited file does not exist in the repository: ${f.path}.`,
        details: { claim: f.path, kind: "file" },
      });
    }
  }

  // UNSAFE_RESPONSE — deterministic secret/destructive-command patterns.
  const serialized = JSON.stringify(finalOutput);
  for (const { category, re } of UNSAFE_PATTERNS) {
    const m = serialized.match(re);
    if (m) {
      out.push({
        type: "UNSAFE_RESPONSE",
        stepId: null,
        message: `Output contains a potentially unsafe pattern (${category}).`,
        details: { category, match: m[0].slice(0, 40) },
      });
    }
  }

  return out;
}
