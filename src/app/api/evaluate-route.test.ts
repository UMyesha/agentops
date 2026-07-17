import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getRunDetail: vi.fn(),
  evaluateFinalOutput: vi.fn(),
  upsertEvaluation: vi.fn(),
}));

vi.mock("@/lib/queries/_common", () => ({ getSessionUserId: mocks.getSessionUserId }));
vi.mock("@/lib/queries/runs", () => ({ getRunDetail: mocks.getRunDetail }));
vi.mock("@/evals/evaluationService", () => ({
  evaluateFinalOutput: mocks.evaluateFinalOutput,
  upsertEvaluation: mocks.upsertEvaluation,
}));

const { POST } = await import("@/app/api/runs/[id]/evaluate/route");

const params = Promise.resolve({ id: "run_1" });
const req = () =>
  new Request("http://localhost/api/runs/run_1/evaluate", { method: "POST" });

const OUTCOME = {
  score: 90,
  result: "PASS",
  rubric: [{ id: "overview", label: "Overview", weight: 15, passed: true }],
  feedback: "Solid.",
};

beforeEach(() => {
  mocks.getSessionUserId.mockReset();
  mocks.getRunDetail.mockReset();
  mocks.evaluateFinalOutput.mockReset();
  mocks.upsertEvaluation.mockReset();

  mocks.getSessionUserId.mockResolvedValue("user_1");
  mocks.getRunDetail.mockResolvedValue({
    id: "run_1",
    status: "COMPLETED",
    finalOutput: { projectOverview: "x" },
    evaluation: { score: 50 },
  });
  mocks.evaluateFinalOutput.mockReturnValue(OUTCOME);
  mocks.upsertEvaluation.mockResolvedValue({ runId: "run_1", ...OUTCOME });
});

describe("POST /api/runs/:id/evaluate", () => {
  it("401 when unauthenticated (never evaluates)", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);
    const res = await POST(req(), { params });
    expect(res.status).toBe(401);
    expect(mocks.upsertEvaluation).not.toHaveBeenCalled();
  });

  it("404 when the run is missing or not owned", async () => {
    mocks.getRunDetail.mockResolvedValue(null);
    const res = await POST(req(), { params });
    expect(res.status).toBe(404);
    expect(mocks.upsertEvaluation).not.toHaveBeenCalled();
  });

  it("422 when the run has no final output", async () => {
    mocks.getRunDetail.mockResolvedValue({
      id: "run_1",
      status: "FAILED",
      finalOutput: null,
      evaluation: null,
    });
    const res = await POST(req(), { params });
    expect(res.status).toBe(422);
    expect(mocks.upsertEvaluation).not.toHaveBeenCalled();
  });

  it("200 with the updated evaluation on success", async () => {
    const res = await POST(req(), { params });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      runId: "run_1",
      score: 90,
      result: "PASS",
      rubric: OUTCOME.rubric,
      feedback: "Solid.",
    });
    expect(mocks.upsertEvaluation).toHaveBeenCalledTimes(1); // one upsert, no duplicate rows
  });

  it("500 when evaluation validation/persistence fails (existing result preserved)", async () => {
    // upsertEvaluation validates-before-write and throws; the route must not
    // treat this as success, and no overwrite occurs (guaranteed by the service).
    mocks.upsertEvaluation.mockRejectedValue(new Error("Invalid evaluation outcome"));
    const res = await POST(req(), { params });
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toHaveProperty("error");
  });
});
