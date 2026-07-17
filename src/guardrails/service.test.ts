import { describe, it, expect, beforeEach, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */

const mocks = vi.hoisted(() => {
  const state: any = { run: null, violations: [] as any[], audits: [] as any[], throwOnCreate: false };
  const db = {
    agentRun: { findUnique: async () => state.run },
    guardrailViolation: {
      createMany: async ({ data }: any) => {
        if (state.throwOnCreate) throw new Error("db down");
        state.violations.push(...data);
        return { count: data.length };
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

const { runGuardrails } = await import("@/guardrails/service");
const s = mocks.state;

// A failed-run snapshot that yields TOOL_FAILURE + SKIPPED_STEP + EMPTY_OUTPUT.
function failedRun() {
  return {
    status: "FAILED",
    finalOutput: null,
    steps: [
      { role: "PLANNER", status: "COMPLETED", error: null, toolCalls: [] },
      {
        role: "CODE_SEARCH",
        status: "FAILED",
        error: "ENOENT",
        toolCalls: [
          { stepId: "s2", toolName: "readFile", status: "ERROR", error: "ENOENT: not found" },
        ],
      },
      { role: "DOCUMENTATION", status: "SKIPPED", error: null, toolCalls: [] },
      { role: "VALIDATOR", status: "SKIPPED", error: null, toolCalls: [] },
      { role: "EVALUATOR", status: "SKIPPED", error: null, toolCalls: [] },
    ],
    guardrails: [] as any[],
  };
}

beforeEach(() => {
  s.run = failedRun();
  s.violations = [];
  s.audits = [];
  s.throwOnCreate = false;
});

describe("guardrail service", () => {
  it("persists derived violations and audits them", async () => {
    const res = await runGuardrails({ runId: "run_1", userId: "u1" });

    expect(res.skipped).toBe(false);
    const persistedTypes = s.violations.map((v: any) => v.type);
    expect(persistedTypes).toContain("TOOL_FAILURE");
    expect(persistedTypes).toContain("SKIPPED_STEP");
    expect(persistedTypes).toContain("EMPTY_OUTPUT");

    const auditActions = s.audits.map((a: any) => a.action);
    expect(auditActions).toContain("guardrail.violation_created");
    expect(auditActions).toContain("guardrails.completed");
  });

  it("is idempotent — a second pass creates no duplicates", async () => {
    const first = await runGuardrails({ runId: "run_1", userId: "u1" });
    const createdFirst = first.created;
    expect(createdFirst).toBeGreaterThan(0);

    // Feed the just-created violations back as existing (what the DB would show).
    s.run.guardrails = s.violations.map((v: any) => ({
      type: v.type,
      stepId: v.stepId,
      message: v.message,
    }));
    const countBefore = s.violations.length;

    const second = await runGuardrails({ runId: "run_1", userId: "u1" });
    expect(second.created).toBe(0);
    expect(s.violations.length).toBe(countBefore); // nothing new persisted
  });

  it("is non-fatal when persistence throws", async () => {
    s.throwOnCreate = true;
    const res = await runGuardrails({ runId: "run_1", userId: "u1" });
    // Swallowed: no throw, nothing persisted.
    expect(res).toBeDefined();
    expect(s.violations).toHaveLength(0);
  });

  it("skips cleanly when the run cannot be loaded", async () => {
    s.run = null;
    const res = await runGuardrails({ runId: "missing", userId: "u1" });
    expect(res.skipped).toBe(true);
    expect(s.violations).toHaveLength(0);
  });
});
