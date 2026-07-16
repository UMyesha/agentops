import { describe, it, expect, beforeEach, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock the auth boundary and the runner so this exercises the route contract
// (status codes, body validation, error mapping) rather than the pipeline.
const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  executeWorkflowRun: vi.fn(),
}));

vi.mock("@/lib/queries/_common", () => ({
  getSessionUserId: mocks.getSessionUserId,
}));

vi.mock("@/agents/runner", async () => {
  class WorkflowNotFoundError extends Error {
    constructor(id: string) {
      super(`Workflow ${id} not found`);
      this.name = "WorkflowNotFoundError";
    }
  }
  return {
    executeWorkflowRun: mocks.executeWorkflowRun,
    WorkflowNotFoundError,
  };
});

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
  mocks.getSessionUserId.mockReset();
  mocks.executeWorkflowRun.mockReset();
  mocks.getSessionUserId.mockResolvedValue("user_1");
  mocks.executeWorkflowRun.mockResolvedValue({
    runId: "run_1",
    status: "COMPLETED",
  });
});

describe("POST /api/workflows/:id/runs", () => {
  it("401 when unauthenticated — and never starts a run", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);

    const res = await POST(req({ request: "Onboard me." }), { params });

    expect(res.status).toBe(401);
    expect(mocks.executeWorkflowRun).not.toHaveBeenCalled();
  });

  it("404 when the workflow is missing or not owned", async () => {
    mocks.executeWorkflowRun.mockRejectedValue(new WorkflowNotFoundError("wf_1"));

    const res = await POST(req({ request: "Onboard me." }), { params });

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toHaveProperty("error");
  });

  it("passes the authenticated user through for the ownership check", async () => {
    mocks.getSessionUserId.mockResolvedValue("user_42");

    await POST(req({ request: "Onboard me." }), { params });

    expect(mocks.executeWorkflowRun).toHaveBeenCalledWith(
      expect.objectContaining({ workflowId: "wf_1", userId: "user_42" })
    );
  });

  it("400 for an invalid body", async () => {
    const tooLong = await POST(req({ request: "x".repeat(1001) }), { params });
    expect(tooLong.status).toBe(400);

    const wrongType = await POST(req({ request: 123 }), { params });
    expect(wrongType.status).toBe(400);

    const empty = await POST(req({ request: "" }), { params });
    expect(empty.status).toBe(400);

    expect(mocks.executeWorkflowRun).not.toHaveBeenCalled();
  });

  it("422 when the workflow/provider is misconfigured", async () => {
    mocks.executeWorkflowRun.mockRejectedValue(
      new WorkflowConfigError(["Agent PLANNER has no active prompt version."])
    );

    const res = await POST(req({ request: "Onboard me." }), { params });

    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.issues).toContain("Agent PLANNER has no active prompt version.");
  });

  it("201 with runId and terminal status on success", async () => {
    const res = await POST(req({ request: "Onboard me." }), { params });

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      runId: "run_1",
      status: "COMPLETED",
    });
  });

  it("201 with FAILED status — a failed run is data, not an HTTP error", async () => {
    mocks.executeWorkflowRun.mockResolvedValue({
      runId: "run_2",
      status: "FAILED",
    });

    const res = await POST(req({ request: "simulate failure" }), { params });

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({
      runId: "run_2",
      status: "FAILED",
    });
  });

  it("falls back to a default request when the body is empty", async () => {
    const res = await POST(req(), { params });

    expect(res.status).toBe(201);
    expect(mocks.executeWorkflowRun).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.stringContaining("onboarding documentation"),
      })
    );
  });

  it("500 on an unexpected error", async () => {
    mocks.executeWorkflowRun.mockRejectedValue(new Error("boom"));
    const res = await POST(req({ request: "Onboard me." }), { params });
    expect(res.status).toBe(500);
  });
});
