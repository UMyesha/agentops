import { describe, it, expect, beforeEach, vi } from "vitest";
import { TOOL_NAMES } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Verifies the Phase 4 runner integration contract by mocking the two
// collaborators (evaluation upsert + guardrail pass) so we can assert exactly
// how the runner reacts to their success/failure — without a full fake DB for
// evaluation/guardrail tables.
const mocks = vi.hoisted(() => {
  const state: any = { workflow: null, tools: [], runUpdates: [], audits: [] };
  const db = {
    workflow: { findFirst: async () => state.workflow },
    tool: { findMany: async () => state.tools },
    agentRun: {
      create: async ({ data }: any) => ({ id: "run_1", ...data }),
      update: async ({ where, data }: any) => {
        state.runUpdates.push(data);
        return { id: where.id, ...data };
      },
    },
    runStep: {
      create: async ({ data }: any) => ({ id: `step_${Math.random()}`, ...data }),
      update: async () => ({}),
    },
    toolCall: { create: async ({ data }: any) => ({ id: "tc", ...data }) },
    auditLog: {
      create: async ({ data }: any) => {
        state.audits.push(data);
        return data;
      },
    },
  };
  return {
    state,
    db,
    upsertEvaluation: vi.fn(),
    runGuardrails: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/evals/evaluationService", () => ({
  upsertEvaluation: mocks.upsertEvaluation,
}));
vi.mock("@/guardrails/service", () => ({ runGuardrails: mocks.runGuardrails }));

const { executeWorkflowRun } = await import("@/agents/runner");

const ROLES = [
  ["PLANNER", "Planner Agent"],
  ["CODE_SEARCH", "Code Search Agent"],
  ["DOCUMENTATION", "Documentation Agent"],
  ["VALIDATOR", "Validator Agent"],
  ["EVALUATOR", "Evaluator Agent"],
] as const;

function makeWorkflow() {
  return {
    id: "wf_1",
    projectId: "proj_1",
    project: { id: "proj_1", ownerId: "user_1" },
    agents: ROLES.map(([role, name], i) => ({
      id: `agent_${i + 1}`,
      role,
      name,
      order: i + 1,
      model: "mock",
      promptVersions: [{ version: 2, content: `You are the ${role}.` }],
    })),
  };
}

const s = mocks.state;
const opts = { workflowId: "wf_1", userId: "user_1", request: "Onboard me." };
const lastUpdate = () => s.runUpdates[s.runUpdates.length - 1];

beforeEach(() => {
  s.workflow = makeWorkflow();
  s.tools = TOOL_NAMES.map((name) => ({ name }));
  s.runUpdates = [];
  s.audits = [];
  mocks.upsertEvaluation.mockReset().mockResolvedValue({});
  mocks.runGuardrails.mockReset().mockResolvedValue({ created: 0, total: 0, skipped: false });
});

describe("runner ↔ Phase 4 integration", () => {
  it("success: upserts the evaluation then runs guardrails, COMPLETED", async () => {
    const res = await executeWorkflowRun(opts);

    expect(res.status).toBe("COMPLETED");
    expect(mocks.upsertEvaluation).toHaveBeenCalledTimes(1);
    expect(mocks.upsertEvaluation).toHaveBeenCalledWith(
      "run_1",
      expect.objectContaining({ score: expect.any(Number), result: expect.any(String) })
    );
    expect(mocks.runGuardrails).toHaveBeenCalledWith({ runId: "run_1", userId: "user_1" });
    expect(lastUpdate().status).toBe("COMPLETED");
  });

  it("evaluation persistence failure → run FAILED, document preserved as finalOutput", async () => {
    mocks.upsertEvaluation.mockRejectedValue(new Error("db write failed"));

    const res = await executeWorkflowRun(opts);

    expect(res.status).toBe("FAILED");
    const update = lastUpdate();
    expect(update.status).toBe("FAILED");
    expect(update.failureReason).toMatch(/Evaluation persistence failed/);
    // The Documentation Agent's valid document is preserved (NOT null) so the
    // guardrail engine won't misread it as EMPTY_OUTPUT.
    expect(update.finalOutput).toBeTruthy();
    expect(update.finalOutput).toHaveProperty("projectOverview");
    // Guardrails still run at finalization for the now-FAILED run.
    expect(mocks.runGuardrails).toHaveBeenCalledWith({ runId: "run_1", userId: "user_1" });
    expect(s.audits.map((a: any) => a.action)).toContain("run.failed");
    expect(s.audits.map((a: any) => a.action)).not.toContain("run.completed");
  });

  it("guardrail failure is non-fatal — run stays COMPLETED", async () => {
    mocks.runGuardrails.mockRejectedValue(new Error("guardrails exploded"));

    const res = await executeWorkflowRun(opts);

    expect(res.status).toBe("COMPLETED");
    expect(lastUpdate().status).toBe("COMPLETED");
  });

  it("step failure path also runs guardrails at finalization", async () => {
    const res = await executeWorkflowRun({
      ...opts,
      request: "Onboard me, simulate failure please.",
    });

    expect(res.status).toBe("FAILED");
    expect(mocks.runGuardrails).toHaveBeenCalledWith({ runId: "run_1", userId: "user_1" });
    // Evaluation is never reached when an earlier step fails.
    expect(mocks.upsertEvaluation).not.toHaveBeenCalled();
  });
});
