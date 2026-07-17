import { describe, it, expect } from "vitest";
import { deriveViolations, type TraceSnapshot } from "@/guardrails/rules";
import { MOCK_REPO } from "@/agents/definitions/mock-repo";
import type { OnboardingDoc } from "@/types";

const goodDoc: OnboardingDoc = {
  projectOverview:
    "taskflow-api is a TypeScript REST backend for team task management built on express and prisma. It exposes auth and task endpoints.",
  setupInstructions:
    "1. Run npm install. 2. Copy .env.example to .env. 3. Run npm run db:migrate. 4. Start with npm run dev. 5. Run npm test.",
  folderStructure:
    "src/ — application code\nsrc/routes/ — handlers\nsrc/middleware/ — guards\nprisma/ — schema",
  keyFiles: [
    { path: "src/index.ts", explanation: "Entry point that mounts the routers and starts the server process." },
    { path: "src/routes/auth.ts", explanation: "Authentication routes issuing JWTs on successful login with bcrypt." },
    { path: "src/middleware/auth.ts", explanation: "Middleware verifying the bearer token on every protected route." },
  ],
  developmentWorkflow:
    "Use npm run dev for hot reload, npm run lint to lint, and npm test before opening a pull request against main.",
};

const ALL_ROLES = ["PLANNER", "CODE_SEARCH", "DOCUMENTATION", "VALIDATOR", "EVALUATOR"] as const;

function completedSnapshot(finalOutput: unknown): TraceSnapshot {
  return {
    run: { status: "COMPLETED", finalOutput },
    steps: ALL_ROLES.map((role) => ({ role, status: "COMPLETED", error: null })),
    toolCalls: [
      { stepId: "s2", toolName: "listRepoFiles", status: "SUCCESS", error: null },
    ],
    repo: MOCK_REPO,
  };
}

const types = (vs: ReturnType<typeof deriveViolations>) => vs.map((v) => v.type);

describe("guardrail rules — clean completed run", () => {
  it("produces no violations for a good grounded document", () => {
    expect(deriveViolations(completedSnapshot(goodDoc))).toHaveLength(0);
  });
});

describe("guardrail rules — completed-run content checks", () => {
  it("MISSING_SECTION when a required section is empty", () => {
    const vs = deriveViolations(
      completedSnapshot({ ...goodDoc, developmentWorkflow: "" })
    );
    const mv = vs.find((v) => v.type === "MISSING_SECTION");
    expect(mv).toBeTruthy();
    expect((mv!.details as { missingSections: string[] }).missingSections).toContain(
      "developmentWorkflow"
    );
  });

  it("TOO_SHORT when the document is below the length threshold", () => {
    const tiny: OnboardingDoc = {
      projectOverview: "x",
      setupInstructions: "y",
      folderStructure: "z",
      keyFiles: [{ path: "src/index.ts", explanation: "a" }],
      developmentWorkflow: "w",
    };
    expect(types(deriveViolations(completedSnapshot(tiny)))).toContain("TOO_SHORT");
  });

  it("UNSUPPORTED_CLAIM when a cited file is not in the repo", () => {
    const vs = deriveViolations(
      completedSnapshot({
        ...goodDoc,
        keyFiles: [
          ...goodDoc.keyFiles,
          { path: "src/does/not/exist.ts", explanation: "A fabricated file not present in the repository." },
        ],
      })
    );
    const uc = vs.find((v) => v.type === "UNSUPPORTED_CLAIM");
    expect(uc).toBeTruthy();
    expect((uc!.details as { claim: string }).claim).toBe("src/does/not/exist.ts");
  });

  it("MALFORMED_OUTPUT when final output is not a valid document", () => {
    expect(types(deriveViolations(completedSnapshot({ nonsense: true })))).toContain(
      "MALFORMED_OUTPUT"
    );
  });

  it("EMPTY_OUTPUT when a valid document has only empty sections", () => {
    const empty: OnboardingDoc = {
      projectOverview: "",
      setupInstructions: "",
      folderStructure: "",
      keyFiles: [],
      developmentWorkflow: "",
    };
    expect(types(deriveViolations(completedSnapshot(empty)))).toContain("EMPTY_OUTPUT");
  });

  it("UNSAFE_RESPONSE when output contains a secret or destructive command", () => {
    const unsafe = {
      ...goodDoc,
      setupInstructions:
        "Export OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz012345 then run rm -rf / to reset.",
    };
    const vs = deriveViolations(completedSnapshot(unsafe));
    const cats = vs
      .filter((v) => v.type === "UNSAFE_RESPONSE")
      .map((v) => (v.details as { category: string }).category);
    expect(cats).toContain("openai_key");
    expect(cats).toContain("destructive_rm");
  });
});

describe("guardrail rules — failed run", () => {
  it("derives TOOL_FAILURE, SKIPPED_STEP and EMPTY_OUTPUT together", () => {
    const snap: TraceSnapshot = {
      run: { status: "FAILED", finalOutput: null },
      steps: [
        { role: "PLANNER", status: "COMPLETED", error: null },
        { role: "CODE_SEARCH", status: "FAILED", error: "ENOENT: file not found" },
        { role: "DOCUMENTATION", status: "SKIPPED", error: null },
        { role: "VALIDATOR", status: "SKIPPED", error: null },
        { role: "EVALUATOR", status: "SKIPPED", error: null },
      ],
      toolCalls: [
        { stepId: "s2", toolName: "listRepoFiles", status: "SUCCESS", error: null },
        { stepId: "s2", toolName: "readFile", status: "ERROR", error: "ENOENT: file not found in repository: src/routes/projects.ts" },
      ],
      repo: MOCK_REPO,
    };
    const t = types(deriveViolations(snap));
    expect(t).toContain("TOOL_FAILURE");
    expect(t).toContain("SKIPPED_STEP");
    expect(t).toContain("EMPTY_OUTPUT");

    // SKIPPED_STEP summarizes the three skipped roles once.
    const skipped = deriveViolations(snap).filter((v) => v.type === "SKIPPED_STEP");
    expect(skipped).toHaveLength(1);
    expect((skipped[0].details as { skippedRoles: string[] }).skippedRoles).toEqual([
      "DOCUMENTATION",
      "VALIDATOR",
      "EVALUATOR",
    ]);
  });

  it("derives MALFORMED_OUTPUT from a step that failed its output contract", () => {
    const snap: TraceSnapshot = {
      run: { status: "FAILED", finalOutput: null },
      steps: [
        { role: "PLANNER", status: "COMPLETED", error: null },
        { role: "CODE_SEARCH", status: "FAILED", error: "CODE_SEARCH returned output that does not match its contract: gathered Required" },
        { role: "DOCUMENTATION", status: "SKIPPED", error: null },
        { role: "VALIDATOR", status: "SKIPPED", error: null },
        { role: "EVALUATOR", status: "SKIPPED", error: null },
      ],
      toolCalls: [],
      repo: MOCK_REPO,
    };
    expect(types(deriveViolations(snap))).toContain("MALFORMED_OUTPUT");
  });

  it("does NOT emit EMPTY_OUTPUT when a failed run preserved a valid document", () => {
    // e.g. evaluation-persistence failure after Documentation produced a doc.
    const snap: TraceSnapshot = {
      run: { status: "FAILED", finalOutput: goodDoc },
      steps: ALL_ROLES.map((role) => ({ role, status: "COMPLETED", error: null })),
      toolCalls: [],
      repo: MOCK_REPO,
    };
    expect(types(deriveViolations(snap))).not.toContain("EMPTY_OUTPUT");
  });
});
