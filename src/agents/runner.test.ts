import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockAgentProvider } from "@/agents/providers/mock";
import type { AgentContext, AgentProvider, AgentResult } from "@/agents/provider";
import { TOOL_NAMES } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── In-memory stand-in for Prisma ────────────────────────────────────────────
// Mocking the db singleton covers every writer (runner, runTool, logAudit),
// so we can assert the exact write sequence without a database.
const mocks = vi.hoisted(() => {
  const state: any = {
    workflow: null,
    tools: [] as { name: string }[],
    runs: [] as any[],
    runUpdates: [] as any[],
    steps: [] as any[],
    stepUpdates: [] as any[],
    toolCalls: [] as any[],
    evaluations: [] as any[],
    audits: [] as any[],
    seq: 0,
  };

  const db = {
    workflow: { findFirst: async () => state.workflow },
    tool: { findMany: async () => state.tools },
    agentRun: {
      create: async ({ data }: any) => {
        const r = { id: "run_1", ...data };
        state.runs.push(r);
        return r;
      },
      update: async ({ where, data }: any) => {
        state.runUpdates.push({ where, data });
        return { id: where.id, ...data };
      },
      // Phase 5: executeExistingRun loads the created (QUEUED) run here…
      findFirst: async () => state.runs[state.runs.length - 1] ?? null,
      // …then claims it (QUEUED→RUNNING) via updateMany. Record it as a run
      // update so the RUNNING-transition assertions still hold, and claim once.
      updateMany: async ({ where, data }: any) => {
        state.runUpdates.push({ where, data });
        return { count: 1 };
      },
      // Phase 4 guardrail finalization loads the run here; returning null makes
      // the guardrail pass a clean no-op in these runner-focused tests.
      findUnique: async () => null,
    },
    runStep: {
      create: async ({ data }: any) => {
        const s = { id: `step_${++state.seq}`, ...data };
        state.steps.push(s);
        return s;
      },
      update: async ({ where, data }: any) => {
        state.stepUpdates.push({ where, data });
        return { id: where.id, ...data };
      },
    },
    toolCall: {
      create: async ({ data }: any) => {
        const t = { id: `tc_${++state.seq}`, ...data };
        state.toolCalls.push(t);
        return t;
      },
    },
    evaluationResult: {
      // Phase 4: the runner now persists via the shared upsertEvaluation.
      findUnique: async () => null,
      upsert: async ({ create }: any) => {
        state.evaluations.push(create);
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

// Imported after the mock is registered.
const { executeWorkflowRun, WorkflowNotFoundError } = await import("@/agents/runner");
const { WorkflowConfigError } = await import("@/agents/preflight");

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ROLES = [
  ["PLANNER", "Planner Agent"],
  ["CODE_SEARCH", "Code Search Agent"],
  ["DOCUMENTATION", "Documentation Agent"],
  ["VALIDATOR", "Validator Agent"],
  ["EVALUATOR", "Evaluator Agent"],
] as const;

function makeWorkflow(opts: { agents?: any[] } = {}) {
  return {
    id: "wf_1",
    projectId: "proj_1",
    name: "Repository Onboarding",
    description: null,
    definition: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    project: { id: "proj_1", ownerId: "user_1" },
    agents:
      opts.agents ??
      ROLES.map(([role, name], i) => ({
        id: `agent_${i + 1}`,
        workflowId: "wf_1",
        role,
        name,
        description: null,
        order: i + 1,
        model: "mock",
        createdAt: new Date(),
        updatedAt: new Date(),
        promptVersions: [
          {
            id: `pv_${i + 1}`,
            agentId: `agent_${i + 1}`,
            version: 2,
            content: `You are the ${role}.`,
            notes: null,
            isActive: true,
            createdAt: new Date(),
          },
        ],
      })),
  };
}

const s = mocks.state;

beforeEach(() => {
  s.workflow = makeWorkflow();
  s.tools = TOOL_NAMES.map((name) => ({ name }));
  s.runs = [];
  s.runUpdates = [];
  s.steps = [];
  s.stepUpdates = [];
  s.toolCalls = [];
  s.evaluations = [];
  s.audits = [];
  s.seq = 0;
});

const baseOpts = {
  workflowId: "wf_1",
  userId: "user_1",
  request: "Generate onboarding documentation for a new developer.",
};

const auditActions = () => s.audits.map((a: any) => a.action);
const lastRunUpdate = () => s.runUpdates[s.runUpdates.length - 1].data;

// ── Successful lifecycle ─────────────────────────────────────────────────────

describe("runner — successful lifecycle", () => {
  it("runs all five agents and completes", async () => {
    const res = await executeWorkflowRun({
      ...baseOpts,
      provider: new MockAgentProvider(),
    });

    expect(res.status).toBe("COMPLETED");
    expect(res.runId).toBe("run_1");

    // Created QUEUED, with a prompt-version snapshot.
    expect(s.runs).toHaveLength(1);
    expect(s.runs[0].status).toBe("QUEUED");
    expect(s.runs[0].promptVersionSnapshot).toHaveLength(5);
    expect(s.runs[0].model).toBe("mock");

    // QUEUED → RUNNING → COMPLETED.
    expect(s.runUpdates[0].data.status).toBe("RUNNING");
    expect(s.runUpdates[0].data.startedAt).toBeInstanceOf(Date);
    expect(lastRunUpdate().status).toBe("COMPLETED");
  });

  it("writes five ordered steps, all COMPLETED", async () => {
    await executeWorkflowRun({ ...baseOpts, provider: new MockAgentProvider() });

    expect(s.steps).toHaveLength(5);
    expect(s.steps.map((x: any) => x.role)).toEqual(ROLES.map(([r]) => r));
    expect(s.steps.map((x: any) => x.order)).toEqual([1, 2, 3, 4, 5]);
    expect(s.steps.every((x: any) => x.status === "RUNNING")).toBe(true); // created RUNNING
    expect(s.stepUpdates).toHaveLength(5);
    expect(s.stepUpdates.every((u: any) => u.data.status === "COMPLETED")).toBe(true);
    expect(s.stepUpdates.every((u: any) => typeof u.data.latencyMs === "number")).toBe(true);
  });

  it("persists tool calls made by the agents", async () => {
    await executeWorkflowRun({ ...baseOpts, provider: new MockAgentProvider() });

    expect(s.toolCalls.length).toBeGreaterThan(0);
    expect(s.toolCalls.every((t: any) => t.status === "SUCCESS")).toBe(true);
    const names = s.toolCalls.map((t: any) => t.toolName);
    expect(names).toContain("listRepoFiles");
    expect(names).toContain("getPackageJson");
    expect(names).toContain("readFile");
    expect(names).toContain("searchFiles");
    expect(names).toContain("validateOutput");
    expect(names).toContain("scoreOutput");
    // Every call records timing + both payloads.
    for (const t of s.toolCalls) {
      expect(t.startedAt).toBeInstanceOf(Date);
      expect(t.completedAt).toBeInstanceOf(Date);
      expect(typeof t.latencyMs).toBe("number");
      expect(t.input).toBeDefined();
      expect(t.output).toBeDefined();
    }
  });

  it("creates a fully-populated EvaluationResult", async () => {
    await executeWorkflowRun({ ...baseOpts, provider: new MockAgentProvider() });

    expect(s.evaluations).toHaveLength(1);
    const e = s.evaluations[0];
    expect(e.runId).toBe("run_1");
    expect(typeof e.score).toBe("number");
    expect(["PASS", "FAIL"]).toContain(e.result);
    expect(e.feedback.length).toBeGreaterThan(0); // NOT NULL column
    expect(e.rubric).toHaveLength(8);
    // Shape the Phase 2 EvaluationPanel renders (keys on `id`).
    for (const c of e.rubric) {
      expect(c.id).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(typeof c.weight).toBe("number");
      expect(typeof c.passed).toBe("boolean");
    }
  });

  it("saves the final output and computes metrics with ZERO cost for mock", async () => {
    await executeWorkflowRun({ ...baseOpts, provider: new MockAgentProvider() });

    const final = lastRunUpdate();
    expect(final.finalOutput).toHaveProperty("projectOverview");
    expect(final.finalOutput).toHaveProperty("keyFiles");
    expect(final.estTokens).toBeGreaterThan(0);
    expect(typeof final.totalLatencyMs).toBe("number");
    expect(final.estCostUsd).toBe(0); // mock makes no API calls
  });

  it("writes the run audit trail", async () => {
    await executeWorkflowRun({ ...baseOpts, provider: new MockAgentProvider() });
    expect(auditActions()).toEqual(
      expect.arrayContaining([
        "run.created",
        "run.worker_started",
        "run.worker_completed",
      ])
    );
    expect(auditActions()).not.toContain("run.worker_failed");
  });
});

// ── Failure lifecycle ────────────────────────────────────────────────────────

describe("runner — failure lifecycle", () => {
  const failOpts = {
    ...baseOpts,
    request: "Onboard me, and simulate failure please.",
    provider: new MockAgentProvider(),
  };

  it("fails the run when a tool errors", async () => {
    const res = await executeWorkflowRun(failOpts);
    expect(res.status).toBe("FAILED");

    const final = lastRunUpdate();
    expect(final.status).toBe("FAILED");
    expect(final.failureReason).toMatch(/CODE_SEARCH/);
    expect(final.failureReason).toMatch(/ENOENT/);
  });

  it("marks the failing step FAILED and preserves the partial trace", async () => {
    await executeWorkflowRun(failOpts);

    // Planner completed before the failure — that portion of the trace stands.
    const completed = s.stepUpdates.filter((u: any) => u.data.status === "COMPLETED");
    expect(completed).toHaveLength(1);

    const failed = s.stepUpdates.filter((u: any) => u.data.status === "FAILED");
    expect(failed).toHaveLength(1);
    expect(failed[0].data.error).toMatch(/ENOENT/);
    expect(typeof failed[0].data.latencyMs).toBe("number");

    // Successful tool calls made before the failure are still recorded.
    expect(s.toolCalls.some((t: any) => t.status === "SUCCESS")).toBe(true);
  });

  it("persists an ERROR ToolCall for the failing tool", async () => {
    await executeWorkflowRun(failOpts);

    const errors = s.toolCalls.filter((t: any) => t.status === "ERROR");
    expect(errors).toHaveLength(1);
    expect(errors[0].toolName).toBe("readFile");
    expect(errors[0].error).toMatch(/src\/routes\/projects\.ts/);
    expect(errors[0].input).toEqual({ path: "src/routes/projects.ts" });
    expect(errors[0].completedAt).toBeInstanceOf(Date);
  });

  it("marks every downstream step SKIPPED with no timings", async () => {
    await executeWorkflowRun(failOpts);

    const skipped = s.steps.filter((x: any) => x.status === "SKIPPED");
    expect(skipped.map((x: any) => x.role)).toEqual([
      "DOCUMENTATION",
      "VALIDATOR",
      "EVALUATOR",
    ]);
    for (const x of skipped) {
      expect(x.startedAt).toBeUndefined();
      expect(x.completedAt).toBeUndefined();
      expect(x.latencyMs).toBeUndefined();
    }
    // All five steps still exist, in order.
    expect(s.steps).toHaveLength(5);
    expect(s.steps.map((x: any) => x.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it("creates no EvaluationResult and audits the failure", async () => {
    await executeWorkflowRun(failOpts);
    expect(s.evaluations).toHaveLength(0);
    expect(auditActions()).toContain("tool.failed");
    expect(auditActions()).toContain("run.worker_failed");
    expect(auditActions()).not.toContain("run.worker_completed");
  });
});

// ── Guards ───────────────────────────────────────────────────────────────────

describe("runner — tool allowlist", () => {
  it("rejects a tool outside the agent's allowlist and fails the step", async () => {
    // A provider that (mis)behaves: the Planner is allowed no tools at all.
    const rogue: AgentProvider = {
      name: "mock",
      model: "mock",
      async run(ctx: AgentContext): Promise<AgentResult> {
        if (ctx.role === "PLANNER") {
          await ctx.callTool("readFile", { path: "src/index.ts" });
        }
        return { output: { plan: ["never reached"] }, estTokens: 1 };
      },
    };

    const res = await executeWorkflowRun({ ...baseOpts, provider: rogue });
    expect(res.status).toBe("FAILED");

    const errors = s.toolCalls.filter((t: any) => t.status === "ERROR");
    expect(errors).toHaveLength(1);
    expect(errors[0].toolName).toBe("readFile");
    expect(errors[0].error).toMatch(/not available to this agent/);
    expect(lastRunUpdate().status).toBe("FAILED");
  });

  it("rejects an unknown tool name", async () => {
    const rogue: AgentProvider = {
      name: "mock",
      model: "mock",
      async run(ctx: AgentContext): Promise<AgentResult> {
        if (ctx.role === "CODE_SEARCH") {
          await ctx.callTool("deleteEverything", {});
        }
        return { output: { plan: ["x"] }, estTokens: 1 };
      },
    };
    await executeWorkflowRun({ ...baseOpts, provider: rogue });
    const errors = s.toolCalls.filter((t: any) => t.status === "ERROR");
    expect(errors.some((e: any) => e.toolName === "deleteEverything")).toBe(true);
  });
});

describe("runner — preflight", () => {
  const provider = new MockAgentProvider();

  const expectNoRowsWritten = () => {
    expect(s.runs).toHaveLength(0);
    expect(s.steps).toHaveLength(0);
    expect(s.toolCalls).toHaveLength(0);
    expect(s.audits).toHaveLength(0);
  };

  it("throws WorkflowNotFoundError when the workflow is not owned/found", async () => {
    s.workflow = null;
    await expect(
      executeWorkflowRun({ ...baseOpts, provider })
    ).rejects.toBeInstanceOf(WorkflowNotFoundError);
    expectNoRowsWritten();
  });

  it("rejects an agent with no active prompt version — and writes nothing", async () => {
    const agents = makeWorkflow().agents;
    agents[2].promptVersions = [];
    s.workflow = makeWorkflow({ agents });

    await expect(
      executeWorkflowRun({ ...baseOpts, provider })
    ).rejects.toBeInstanceOf(WorkflowConfigError);
    expectNoRowsWritten();
  });

  it("rejects an agent with more than one active prompt version", async () => {
    const agents = makeWorkflow().agents;
    agents[0].promptVersions = [
      { ...agents[0].promptVersions[0] },
      { ...agents[0].promptVersions[0], id: "pv_dup", version: 3 },
    ];
    s.workflow = makeWorkflow({ agents });

    await expect(
      executeWorkflowRun({ ...baseOpts, provider })
    ).rejects.toThrow(/active prompt versions/);
    expectNoRowsWritten();
  });

  it("rejects roles in the wrong order", async () => {
    const agents = makeWorkflow().agents;
    [agents[0], agents[1]] = [agents[1], agents[0]];
    s.workflow = makeWorkflow({ agents });

    await expect(
      executeWorkflowRun({ ...baseOpts, provider })
    ).rejects.toBeInstanceOf(WorkflowConfigError);
    expectNoRowsWritten();
  });

  it("rejects a missing agent", async () => {
    s.workflow = makeWorkflow({ agents: makeWorkflow().agents.slice(0, 4) });
    await expect(
      executeWorkflowRun({ ...baseOpts, provider })
    ).rejects.toBeInstanceOf(WorkflowConfigError);
    expectNoRowsWritten();
  });

  it("rejects when a required tool is not seeded", async () => {
    s.tools = [{ name: "listRepoFiles" }]; // the rest are missing
    await expect(
      executeWorkflowRun({ ...baseOpts, provider })
    ).rejects.toThrow(/missing from the tool registry table/);
    expectNoRowsWritten();
  });

  it("surfaces every issue at once", async () => {
    const agents = makeWorkflow().agents;
    agents[1].promptVersions = [];
    agents[3].promptVersions = [];
    s.workflow = makeWorkflow({ agents });

    try {
      await executeWorkflowRun({ ...baseOpts, provider });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(WorkflowConfigError);
      expect((err as InstanceType<typeof WorkflowConfigError>).issues.length).toBe(2);
    }
  });
});
