import { describe, it, expect, beforeEach, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Exercises the async enqueue contract of the workflow-run route: it creates a
// QUEUED run and enqueues a job, returning 202 — it no longer executes inline.
const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  createQueuedRun: vi.fn(),
  enqueueAgentRun: vi.fn(),
  runUpdate: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock("@/lib/queries/_common", () => ({
  getSessionUserId: mocks.getSessionUserId,
}));
vi.mock("@/lib/db", () => ({
  db: {
    agentRun: { update: mocks.runUpdate },
    auditLog: { create: mocks.auditCreate },
  },
}));
vi.mock("@/agents/runner", () => {
  class WorkflowNotFoundError extends Error {
    constructor(id: string) {
      super(`Workflow ${id} not found`);
      this.name = "WorkflowNotFoundError";
    }
  }
  return { createQueuedRun: mocks.createQueuedRun, WorkflowNotFoundError };
});
vi.mock("@/agents/preflight", () => {
  class WorkflowConfigError extends Error {
    readonly issues: string[];
    constructor(issues: string[]) {
      super("config");
      this.name = "WorkflowConfigError";
      this.issues = issues;
    }
  }
  return { WorkflowConfigError };
});
vi.mock("@/queue/agentRunQueue", () => ({
  enqueueAgentRun: mocks.enqueueAgentRun,
}));

const { POST } = await import("@/app/api/workflows/[id]/runs/route");
const { WorkflowNotFoundError } = await import("@/agents/runner");
const { WorkflowConfigError } = await import("@/agents/preflight");

function req(body?: unknown) {
  return new Request("http://localhost/api/workflows/wf_1/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const params = Promise.resolve({ id: "wf_1" });

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.getSessionUserId.mockResolvedValue("user_1");
  mocks.createQueuedRun.mockResolvedValue({ runId: "run_1" });
  mocks.enqueueAgentRun.mockResolvedValue({ id: "run_1" });
  mocks.runUpdate.mockResolvedValue({});
  mocks.auditCreate.mockResolvedValue({});
});

describe("POST /api/workflows/:id/runs — async enqueue", () => {
  it("202 with QUEUED and enqueues one job (jobId = runId)", async () => {
    const res = await POST(req({ request: "Onboard me." }), { params });

    expect(res.status).toBe(202);
    await expect(res.json()).resolves.toEqual({
      runId: "run_1",
      status: "QUEUED",
    });
    expect(mocks.enqueueAgentRun).toHaveBeenCalledWith({
      runId: "run_1",
      userId: "user_1",
    });
  });

  it("401 when unauthenticated (never creates or enqueues)", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);
    const res = await POST(req({ request: "x" }), { params });
    expect(res.status).toBe(401);
    expect(mocks.createQueuedRun).not.toHaveBeenCalled();
    expect(mocks.enqueueAgentRun).not.toHaveBeenCalled();
  });

  it("400 for an invalid body (never enqueues)", async () => {
    const tooLong = await POST(req({ request: "x".repeat(1001) }), { params });
    expect(tooLong.status).toBe(400);
    const empty = await POST(req({ request: "" }), { params });
    expect(empty.status).toBe(400);
    expect(mocks.createQueuedRun).not.toHaveBeenCalled();
  });

  it("404 when the workflow is missing/not owned (preflight before enqueue)", async () => {
    mocks.createQueuedRun.mockRejectedValue(new WorkflowNotFoundError("wf_1"));
    const res = await POST(req({ request: "x" }), { params });
    expect(res.status).toBe(404);
    expect(mocks.enqueueAgentRun).not.toHaveBeenCalled();
  });

  it("422 when the workflow is misconfigured (preflight before enqueue)", async () => {
    mocks.createQueuedRun.mockRejectedValue(
      new WorkflowConfigError(["Agent PLANNER has no active prompt version."])
    );
    const res = await POST(req({ request: "x" }), { params });
    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.issues).toContain("Agent PLANNER has no active prompt version.");
    expect(mocks.enqueueAgentRun).not.toHaveBeenCalled();
  });

  it("503 when enqueue fails — marks the run FAILED (no QUEUED orphan)", async () => {
    mocks.enqueueAgentRun.mockRejectedValue(new Error("redis down"));

    const res = await POST(req({ request: "x" }), { params });

    expect(res.status).toBe(503);
    const body = (await res.json()) as any;
    expect(body.runId).toBe("run_1");
    expect(body.error).toBeTruthy();

    // The created run must not be left QUEUED.
    expect(mocks.runUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run_1" },
        data: expect.objectContaining({ status: "FAILED" }),
      })
    );
    // Enqueue is not retried in-request.
    expect(mocks.enqueueAgentRun).toHaveBeenCalledTimes(1);
  });

  it("falls back to a default request when the body is empty", async () => {
    await POST(req(), { params });
    expect(mocks.createQueuedRun).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: "wf_1",
        userId: "user_1",
        request: expect.stringContaining("onboarding documentation"),
      })
    );
  });

  it("500 on an unexpected createQueuedRun error", async () => {
    mocks.createQueuedRun.mockRejectedValue(new Error("boom"));
    const res = await POST(req({ request: "x" }), { params });
    expect(res.status).toBe(500);
  });
});
