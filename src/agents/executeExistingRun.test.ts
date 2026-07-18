import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TOOL_NAMES } from "@/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// A stateful in-memory Prisma stand-in so we can prove real reset/idempotency:
// steps, tool calls, evaluations, and guardrails actually accumulate and can be
// deleted. The guardrail + evaluation services run for real against it.
const H = vi.hoisted(() => {
  const store: any = {
    run: null,
    steps: [],
    toolCalls: [],
    evaluations: [],
    guardrails: [],
    audits: [],
    workflow: null,
    tools: [],
    seq: 0,
    failEvalUpsert: false,
    failGuardrailWrite: false,
    failAudit: false,
  };

  const db = {
    agentRun: {
      findFirst: async ({ where }: any) => {
        const r = store.run;
        if (!r || r.id !== where.id) return null;
        return { status: r.status, workflowId: r.workflowId, input: r.input };
      },
      updateMany: async ({ where, data }: any) => {
        const r = store.run;
        const allowed = where.status?.in ?? [where.status];
        if (r && r.id === where.id && allowed.includes(r.status)) {
          Object.assign(r, data);
          return { count: 1 };
        }
        return { count: 0 };
      },
      update: async ({ data }: any) => {
        Object.assign(store.run, data);
        return store.run;
      },
      findUnique: async ({ where }: any) => {
        const r = store.run;
        if (!r || r.id !== where.id) return null;
        return {
          status: r.status,
          finalOutput: r.finalOutput ?? null,
          steps: store.steps.map((s: any) => ({
            role: s.role,
            status: s.status,
            error: s.error ?? null,
            toolCalls: store.toolCalls
              .filter((t: any) => t.stepId === s.id)
              .map((t: any) => ({
                stepId: t.stepId,
                toolName: t.toolName,
                status: t.status,
                error: t.error ?? null,
              })),
          })),
          guardrails: store.guardrails.map((g: any) => ({
            type: g.type,
            stepId: g.stepId,
            message: g.message,
          })),
        };
      },
    },
    runStep: {
      create: async ({ data }: any) => {
        const s = { id: `step_${++store.seq}`, ...data };
        store.steps.push(s);
        return s;
      },
      update: async ({ where, data }: any) => {
        const s = store.steps.find((x: any) => x.id === where.id);
        if (s) Object.assign(s, data);
        return s;
      },
      deleteMany: async ({ where }: any) => {
        const n = store.steps.filter((s: any) => s.runId === where.runId).length;
        store.steps = store.steps.filter((s: any) => s.runId !== where.runId);
        store.toolCalls = store.toolCalls.filter(
          (t: any) => t.runId !== where.runId
        );
        return { count: n };
      },
    },
    toolCall: {
      create: async ({ data }: any) => {
        const t = { id: `tc_${++store.seq}`, ...data };
        store.toolCalls.push(t);
        return t;
      },
    },
    evaluationResult: {
      findUnique: async ({ where }: any) =>
        store.evaluations.find((e: any) => e.runId === where.runId) ?? null,
      upsert: async ({ where, create, update }: any) => {
        if (store.failEvalUpsert) throw new Error("eval db down");
        const idx = store.evaluations.findIndex(
          (e: any) => e.runId === where.runId
        );
        if (idx >= 0) {
          store.evaluations[idx] = { ...store.evaluations[idx], ...update };
          return store.evaluations[idx];
        }
        store.evaluations.push({ runId: where.runId, ...create });
        return create;
      },
      deleteMany: async ({ where }: any) => {
        const n = store.evaluations.filter(
          (e: any) => e.runId === where.runId
        ).length;
        store.evaluations = store.evaluations.filter(
          (e: any) => e.runId !== where.runId
        );
        return { count: n };
      },
    },
    guardrailViolation: {
      createMany: async ({ data }: any) => {
        if (store.failGuardrailWrite) throw new Error("guardrail db down");
        store.guardrails.push(...data);
        return { count: data.length };
      },
      deleteMany: async ({ where }: any) => {
        const n = store.guardrails.filter(
          (g: any) => g.runId === where.runId
        ).length;
        store.guardrails = store.guardrails.filter(
          (g: any) => g.runId !== where.runId
        );
        return { count: n };
      },
    },
    tool: { findMany: async () => store.tools },
    workflow: { findFirst: async () => store.workflow },
    auditLog: {
      create: async ({ data }: any) => {
        if (store.failAudit) throw new Error("audit db down");
        store.audits.push(data);
        return data;
      },
    },
    $transaction: async (arr: any[]) => Promise.all(arr),
  };

  return { store, db };
});

vi.mock("@/lib/db", () => ({ db: H.db }));

const { executeExistingRun } = await import("@/agents/runner");
const { MockAgentProvider } = await import("@/agents/providers/mock");

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

const s = H.store;

function resetStore(runStatus = "QUEUED", request = "Onboard a new developer.") {
  s.run = {
    id: "run_1",
    status: runStatus,
    workflowId: "wf_1",
    input: { request, repo: "taskflow-api" },
    finalOutput: null,
    retryCount: 0,
  };
  s.steps = [];
  s.toolCalls = [];
  s.evaluations = [];
  s.guardrails = [];
  s.audits = [];
  s.workflow = makeWorkflow();
  s.tools = TOOL_NAMES.map((name) => ({ name }));
  s.seq = 0;
  s.failEvalUpsert = false;
  s.failGuardrailWrite = false;
  s.failAudit = false;
}

const base = {
  runId: "run_1",
  userId: "user_1",
  retryAttempt: 1,
  maxAttempts: 3,
  activation: 1,
};
const auditActions = () => s.audits.map((a: any) => a.action);

beforeEach(() => resetStore());
afterEach(() => {
  delete process.env.AGENTOPS_ENABLE_RETRY_TEST_TRIGGERS;
});

describe("executeExistingRun — happy path", () => {
  it("claims QUEUED → RUNNING → COMPLETED with a clean guardrail set", async () => {
    const out = await executeExistingRun({ ...base, provider: new MockAgentProvider() });

    expect(out.kind).toBe("completed");
    expect(s.run.status).toBe("COMPLETED");
    expect(s.steps.filter((x: any) => x.status !== "SKIPPED")).toHaveLength(5);
    expect(s.evaluations).toHaveLength(1);
    expect(s.guardrails).toHaveLength(0); // clean run
    expect(auditActions()).toContain("run.worker_started");
    expect(auditActions()).toContain("run.worker_completed");
  });
});

describe("executeExistingRun — non-retryable business failure", () => {
  it("executes 'simulate failure' once, FAILED, with guardrails", async () => {
    resetStore("QUEUED", "Onboard me and simulate failure.");
    const out = await executeExistingRun({ ...base, provider: new MockAgentProvider() });

    expect(out.kind).toBe("failed_business");
    expect(s.run.status).toBe("FAILED");
    expect(s.evaluations).toHaveLength(0);
    const types = s.guardrails.map((g: any) => g.type);
    expect(types).toContain("TOOL_FAILURE");
    expect(types).toContain("SKIPPED_STEP");
    expect(types).toContain("EMPTY_OUTPUT");
    expect(auditActions()).not.toContain("run.retry_scheduled");
  });
});

describe("executeExistingRun — retries", () => {
  it("retryable failure with attempts left → run back to QUEUED (retry)", async () => {
    process.env.AGENTOPS_ENABLE_RETRY_TEST_TRIGGERS = "true";
    resetStore("QUEUED", "Onboard me. simulate transient failure once");

    const out = await executeExistingRun({
      ...base,
      retryAttempt: 1,
      maxAttempts: 3,
      provider: new MockAgentProvider(),
    });

    expect(out.kind).toBe("retry");
    expect(s.run.status).toBe("QUEUED");
    expect(s.run.retryCount).toBe(1);
    expect(auditActions()).toContain("run.retry_scheduled");
  });

  it("succeeds on the retry attempt; reset leaves only the final trace", async () => {
    process.env.AGENTOPS_ENABLE_RETRY_TEST_TRIGGERS = "true";
    resetStore("QUEUED", "Onboard me. simulate transient failure once");

    // Attempt 1 → retry (planner throws, one FAILED step recorded).
    await executeExistingRun({ ...base, retryAttempt: 1, provider: new MockAgentProvider() });
    expect(s.steps.length).toBeGreaterThan(0);

    // Attempt 2 (re-attempt): reset clears attempt-1 artifacts, then completes.
    const out = await executeExistingRun({
      ...base,
      retryAttempt: 2,
      activation: 2,
      provider: new MockAgentProvider(),
    });

    expect(out.kind).toBe("completed");
    expect(s.run.status).toBe("COMPLETED");
    // Only the final attempt's five steps remain — no duplicates.
    expect(s.steps.filter((x: any) => x.status !== "SKIPPED")).toHaveLength(5);
    expect(s.evaluations).toHaveLength(1); // exactly one EvaluationResult
    expect(s.guardrails).toHaveLength(0); // clean, no duplicates
  });

  it("exhausts retries → FAILED", async () => {
    process.env.AGENTOPS_ENABLE_RETRY_TEST_TRIGGERS = "true";
    resetStore("QUEUED", "Onboard me. simulate transient failure always");

    const out = await executeExistingRun({
      ...base,
      retryAttempt: 1,
      maxAttempts: 1, // no attempts remain
      provider: new MockAgentProvider(),
    });

    expect(out.kind).toBe("retry_exhausted");
    expect(s.run.status).toBe("FAILED");
    expect(s.run.failureReason).toMatch(/PLANNER/);
  });
});

describe("executeExistingRun — duplicate delivery & claim", () => {
  it("is a no-op for an already COMPLETED run", async () => {
    resetStore("COMPLETED");
    const out = await executeExistingRun({ ...base, provider: new MockAgentProvider() });
    expect(out.kind).toBe("noop");
    expect(s.steps).toHaveLength(0);
    expect(auditActions()).not.toContain("run.worker_started");
  });

  it("is a no-op for an already FAILED run", async () => {
    resetStore("FAILED");
    const out = await executeExistingRun({ ...base, provider: new MockAgentProvider() });
    expect(out.kind).toBe("noop");
  });

  it("is a no-op when the claim finds a non-claimable status (concurrent)", async () => {
    // RETRIED is not terminal here but also not claimable → updateMany count 0.
    resetStore("RETRIED");
    const out = await executeExistingRun({ ...base, provider: new MockAgentProvider() });
    expect(out.kind).toBe("noop");
  });
});

describe("executeExistingRun — evaluation is fatal, guardrail/audit non-fatal", () => {
  it("evaluation persistence failure → FAILED, document preserved as finalOutput", async () => {
    s.failEvalUpsert = true;
    const out = await executeExistingRun({ ...base, provider: new MockAgentProvider() });

    expect(out.kind).toBe("failed_business");
    expect(s.run.status).toBe("FAILED");
    expect(s.run.failureReason).toMatch(/Evaluation persistence failed/);
    expect(s.run.finalOutput).toBeTruthy(); // preserved → no false EMPTY_OUTPUT
  });

  it("guardrail persistence failure does not change COMPLETED status", async () => {
    s.failGuardrailWrite = true;
    const out = await executeExistingRun({ ...base, provider: new MockAgentProvider() });
    expect(out.kind).toBe("completed");
    expect(s.run.status).toBe("COMPLETED");
  });

  it("audit failure does not crash the run", async () => {
    s.failAudit = true;
    const out = await executeExistingRun({ ...base, provider: new MockAgentProvider() });
    expect(out.kind).toBe("completed");
    expect(s.run.status).toBe("COMPLETED");
  });
});

describe("executeExistingRun — stalled recovery & lock fence", () => {
  it("recovers a stale RUNNING run (activation>1): re-adopts, resets, completes", async () => {
    resetStore("RUNNING"); // dead worker left it RUNNING
    // A stale partial-trace step from the dead attempt.
    s.steps.push({ id: "stale_1", runId: "run_1", role: "PLANNER", status: "FAILED", order: 1 });

    const out = await executeExistingRun({
      ...base,
      retryAttempt: 1,
      activation: 2, // a re-activation (BullMQ stalled recovery)
      verifyLock: async () => true,
      provider: new MockAgentProvider(),
    });

    expect(out.kind).toBe("completed");
    expect(s.run.status).toBe("COMPLETED"); // not stuck RUNNING
    expect(s.steps.find((x: any) => x.id === "stale_1")).toBeUndefined(); // reset
    expect(s.steps.filter((x: any) => x.status !== "SKIPPED")).toHaveLength(5);
  });

  it("lock lost before the terminal write → no terminal DB write (stays non-terminal)", async () => {
    resetStore("QUEUED");
    const out = await executeExistingRun({
      ...base,
      verifyLock: async () => false, // ownership lost by completion time
      provider: new MockAgentProvider(),
    });

    expect(out.kind).toBe("noop");
    // The run was claimed (RUNNING) but never written to a terminal state.
    expect(s.run.status).toBe("RUNNING");
    expect(s.run.status).not.toBe("COMPLETED");
  });

  it("lock lost before reset → no reset performed", async () => {
    resetStore("RUNNING");
    s.steps.push({ id: "stale_1", runId: "run_1", role: "PLANNER", status: "FAILED", order: 1 });

    const out = await executeExistingRun({
      ...base,
      retryAttempt: 2,
      activation: 2,
      verifyLock: async () => false,
      provider: new MockAgentProvider(),
    });

    expect(out.kind).toBe("noop");
    // Reset must NOT have run — the stale artifact is untouched.
    expect(s.steps.find((x: any) => x.id === "stale_1")).toBeDefined();
  });
});

describe("executeExistingRun — retry-trigger gate", () => {
  it("synthetic phrases are inert when the gate flag is false (default)", async () => {
    // Flag not set → gate off. The phrase must do nothing.
    resetStore("QUEUED", "Onboard me. simulate transient failure once");
    const out = await executeExistingRun({ ...base, provider: new MockAgentProvider() });
    expect(out.kind).toBe("completed");
    expect(s.run.status).toBe("COMPLETED");
  });

  it("gate has no effect when AI_PROVIDER is not mock", async () => {
    const prev = process.env.AI_PROVIDER;
    process.env.AGENTOPS_ENABLE_RETRY_TEST_TRIGGERS = "true";
    process.env.AI_PROVIDER = "openai"; // gate requires AI_PROVIDER=mock
    resetStore("QUEUED", "Onboard me. simulate transient failure always");

    const out = await executeExistingRun({ ...base, provider: new MockAgentProvider() });
    expect(out.kind).toBe("completed"); // inert → normal completion

    process.env.AI_PROVIDER = prev;
  });
});
