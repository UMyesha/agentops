import type {
  EvaluationOutcome,
  MockRepo,
  OnboardingDoc,
  RubricCriterion,
} from "@/types";

/** A run passes at or above this score. */
export const PASS_THRESHOLD = 70;

/**
 * The 8-criterion Repository Onboarding rubric.
 *
 * Weights sum to 100. Each criterion is a deterministic predicate over the
 * generated document plus the real repo context — "grounded" and "specific"
 * are checked against actual repo files rather than guessed at, so the score
 * means something.
 *
 * The emitted shape is exactly `RubricCriterion[]` (id/label/weight/passed/note)
 * because the Phase 2 EvaluationPanel keys on `id` and renders those fields.
 */
interface Criterion {
  id: string;
  label: string;
  weight: number;
  check: (doc: OnboardingDoc, repo: MockRepo) => boolean;
  failNote: string;
}

const nonTrivial = (s: string, min = 40) =>
  typeof s === "string" && s.trim().length >= min;

const CRITERIA: Criterion[] = [
  {
    id: "overview",
    label: "Project overview included",
    weight: 15,
    check: (d) => nonTrivial(d.projectOverview),
    failNote: "Project overview is missing or too thin.",
  },
  {
    id: "setup",
    label: "Setup instructions included",
    weight: 15,
    check: (d) => nonTrivial(d.setupInstructions),
    failNote: "Setup instructions are missing or too thin.",
  },
  {
    id: "structure",
    label: "Folder structure included",
    weight: 12,
    check: (d) => nonTrivial(d.folderStructure, 20),
    failNote: "Folder structure is missing.",
  },
  {
    id: "key-files",
    label: "Key files explained",
    weight: 15,
    check: (d) =>
      Array.isArray(d.keyFiles) &&
      d.keyFiles.length >= 3 &&
      d.keyFiles.every((f) => nonTrivial(f.explanation, 20)),
    failNote: "Fewer than three key files explained, or explanations are thin.",
  },
  {
    id: "dev-workflow",
    label: "Development workflow explained",
    weight: 12,
    check: (d) => nonTrivial(d.developmentWorkflow),
    failNote: "Development workflow is missing or too thin.",
  },
  {
    id: "clarity",
    label: "Output is clear",
    weight: 11,
    check: (d) =>
      [d.projectOverview, d.setupInstructions, d.developmentWorkflow].every(
        (s) => nonTrivial(s, 30)
      ),
    failNote: "One or more sections are too short to be useful.",
  },
  {
    id: "grounded",
    label: "Output avoids unsupported claims",
    weight: 10,
    // Every cited key file must actually exist in the repo.
    check: (d, repo) => {
      const paths = new Set(repo.files.map((f) => f.path));
      return (
        Array.isArray(d.keyFiles) &&
        d.keyFiles.length > 0 &&
        d.keyFiles.every((f) => paths.has(f.path))
      );
    },
    failNote: "Cites files that do not exist in the repository.",
  },
  {
    id: "specific",
    label: "Output is specific to the provided repo context",
    weight: 10,
    // Must reference the repo by name or a real dependency/script from it.
    check: (d, repo) => {
      const haystack = [
        d.projectOverview,
        d.setupInstructions,
        d.folderStructure,
        d.developmentWorkflow,
      ]
        .join(" ")
        .toLowerCase();
      const pkg = repo.files.find((f) => f.path === "package.json");
      const deps: string[] = pkg
        ? Object.keys(
            (JSON.parse(pkg.content) as { dependencies?: Record<string, string> })
              .dependencies ?? {}
          )
        : [];
      return (
        haystack.includes(repo.name.toLowerCase()) ||
        deps.some((dep) => haystack.includes(dep.toLowerCase()))
      );
    },
    failNote:
      "Reads generically; does not reference this repository's name or stack.",
  },
];

/** Deterministically score an onboarding document against the rubric. */
export function scoreOnboardingDoc(
  doc: OnboardingDoc,
  repo: MockRepo
): EvaluationOutcome {
  const rubric: RubricCriterion[] = CRITERIA.map((c) => {
    let passed = false;
    try {
      passed = c.check(doc, repo);
    } catch {
      passed = false; // a malformed doc simply fails the criterion
    }
    return {
      id: c.id,
      label: c.label,
      weight: c.weight,
      passed,
      ...(passed ? {} : { note: c.failNote }),
    };
  });

  const score = rubric.reduce((sum, c) => sum + (c.passed ? c.weight : 0), 0);
  const failed = rubric.filter((c) => !c.passed);
  const result = score >= PASS_THRESHOLD ? "PASS" : "FAIL";

  const feedback =
    failed.length === 0
      ? `Scored ${score}/100 — all ${rubric.length} rubric criteria passed. The onboarding document is complete, grounded in the repository, and specific to it.`
      : `Scored ${score}/100 (${result}). ${failed.length} of ${rubric.length} criteria failed: ${failed
          .map((f) => f.label.toLowerCase())
          .join("; ")}.`;

  return { score, result, rubric, feedback };
}
