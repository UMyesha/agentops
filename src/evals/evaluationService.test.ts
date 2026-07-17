import { describe, it, expect, beforeEach, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */

const mocks = vi.hoisted(() => {
  const state: any = { existing: null, rows: [] as any[], audits: [] as any[] };
  const db = {
    evaluationResult: {
      findUnique: async () => state.existing,
      upsert: async ({ create }: any) => {
        state.rows.push(create);
        return create;
      },
    },
    auditLog: {
      create: async ({ data }: any) => {
        state.audits.push(data);
        return data;
      },
    },
  };
  return { state, db };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));

const { evaluateFinalOutput, upsertEvaluation } = await import(
  "@/evals/evaluationService"
);
const { MOCK_REPO } = await import("@/agents/definitions/mock-repo");
import type { OnboardingDoc } from "@/types";

const goodDoc: OnboardingDoc = {
  projectOverview:
    "taskflow-api is a TypeScript REST backend built on express and prisma with JWT auth.",
  setupInstructions:
    "1. npm install. 2. cp .env.example .env. 3. npm run db:migrate. 4. npm run dev. 5. npm test.",
  folderStructure: "src/ — code\nprisma/ — schema\nsrc/routes/ — handlers",
  keyFiles: [
    { path: "src/index.ts", explanation: "Entry point mounting the routers and starting the server." },
    { path: "src/routes/auth.ts", explanation: "Auth routes issuing JWTs with bcrypt password hashing." },
    { path: "src/middleware/auth.ts", explanation: "Middleware verifying the bearer token on protected routes." },
  ],
  developmentWorkflow: "npm run dev for hot reload; npm run lint; npm test before a PR.",
};

const s = mocks.state;

beforeEach(() => {
  s.existing = null;
  s.rows = [];
  s.audits = [];
});

describe("evaluateFinalOutput", () => {
  it("scores a good document as PASS with a rubric matching the panel shape", () => {
    const outcome = evaluateFinalOutput(goodDoc, MOCK_REPO);
    expect(outcome.result).toBe("PASS");
    expect(outcome.score).toBeGreaterThanOrEqual(70);
    expect(outcome.rubric).toHaveLength(8);
    expect(outcome.feedback.length).toBeGreaterThan(0);
    for (const c of outcome.rubric) {
      expect(c.id).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(typeof c.weight).toBe("number");
      expect(typeof c.passed).toBe("boolean");
    }
    expect(outcome.rubric.reduce((a, c) => a + c.weight, 0)).toBe(100);
  });

  it("scores null/malformed output as 0 / FAIL (does not throw)", () => {
    expect(evaluateFinalOutput(null, MOCK_REPO).result).toBe("FAIL");
    expect(evaluateFinalOutput({ nope: 1 }, MOCK_REPO).score).toBe(0);
  });
});

describe("upsertEvaluation", () => {
  it("creates and audits evaluation.created when none existed", async () => {
    const outcome = evaluateFinalOutput(goodDoc, MOCK_REPO);
    await upsertEvaluation("run_1", outcome);
    expect(s.rows).toHaveLength(1);
    expect(s.audits[0].action).toBe("evaluation.created");
  });

  it("audits evaluation.updated when a result already existed", async () => {
    s.existing = { runId: "run_1", score: 50 };
    await upsertEvaluation("run_1", evaluateFinalOutput(goodDoc, MOCK_REPO));
    expect(s.audits[0].action).toBe("evaluation.updated");
  });

  it("throws WITHOUT writing when the outcome fails validation", async () => {
    const bad = { score: 999, result: "MAYBE", rubric: [], feedback: "" } as any;
    await expect(upsertEvaluation("run_1", bad)).rejects.toThrow();
    expect(s.rows).toHaveLength(0); // nothing written → existing result preserved
    expect(s.audits).toHaveLength(0);
  });
});
