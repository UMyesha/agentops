import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runCount: vi.fn(),
  runAggregate: vi.fn(),
  runFindMany: vi.fn(),
  evalAggregate: vi.fn(),
  guardrailCount: vi.fn(),
}));

vi.mock("@/lib/queries/_common", () => ({
  ownedRunWhere: (userId: string) => ({ project: { ownerId: userId } }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    agentRun: {
      count: mocks.runCount,
      aggregate: mocks.runAggregate,
      findMany: mocks.runFindMany,
    },
    evaluationResult: { aggregate: mocks.evalAggregate },
    guardrailViolation: { count: mocks.guardrailCount },
  },
}));

const { getDashboardMetrics } = await import("@/lib/queries/dashboard");

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  // Order matches Promise.all in the query: total, completed, failed, [aggr],
  // [evalAggr], [guardrail], retried, active, [recent], [recentFailed].
  mocks.runCount
    .mockResolvedValueOnce(25) // total
    .mockResolvedValueOnce(20) // completed
    .mockResolvedValueOnce(5) // failed
    .mockResolvedValueOnce(3) // retried
    .mockResolvedValueOnce(2); // active
  mocks.runAggregate.mockResolvedValue({ _avg: { totalLatencyMs: 8000 } });
  mocks.evalAggregate.mockResolvedValue({ _avg: { score: 90 } });
  mocks.guardrailCount.mockResolvedValue(7);
  mocks.runFindMany.mockResolvedValue([]);
});

describe("getDashboardMetrics", () => {
  it("returns the new guardrail / retried / active counts", async () => {
    const m = await getDashboardMetrics("user_1");
    expect(m.guardrailCount).toBe(7);
    expect(m.retriedRunCount).toBe(3);
    expect(m.activeRunCount).toBe(2);
  });

  it("scopes the retried count to retryCount > 0", async () => {
    await getDashboardMetrics("user_1");
    const retriedCall = mocks.runCount.mock.calls.find(
      ([arg]) => arg?.where?.retryCount?.gt === 0
    );
    expect(retriedCall).toBeDefined();
  });

  it("scopes the active count to QUEUED/RUNNING", async () => {
    await getDashboardMetrics("user_1");
    const activeCall = mocks.runCount.mock.calls.find(
      ([arg]) =>
        Array.isArray(arg?.where?.status?.in) &&
        arg.where.status.in.includes("QUEUED") &&
        arg.where.status.in.includes("RUNNING")
    );
    expect(activeCall).toBeDefined();
  });

  it("still computes the existing roll-ups", async () => {
    const m = await getDashboardMetrics("user_1");
    expect(m.totalRuns).toBe(25);
    expect(m.successRate).toBe(80);
    expect(m.avgCompletedLatencyMs).toBe(8000);
    expect(m.avgEvalScore).toBe(90);
  });
});
