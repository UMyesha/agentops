import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runFindFirst: vi.fn(),
  auditFindMany: vi.fn(),
}));

vi.mock("@/lib/queries/_common", () => ({
  ownedRunWhere: (userId: string) => ({ project: { ownerId: userId } }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    agentRun: { findFirst: mocks.runFindFirst },
    auditLog: { findMany: mocks.auditFindMany },
  },
}));

const { getRunDetail, getRunAuditTrail } = await import("@/lib/queries/runs");

beforeEach(() => {
  mocks.runFindFirst.mockReset();
  mocks.auditFindMany.mockReset();
});

describe("owner-scoped run queries (authorization regression)", () => {
  it("getRunDetail scopes the query to the owner and returns null when not owned", async () => {
    mocks.runFindFirst.mockResolvedValue(null); // simulate not-owned / missing
    const result = await getRunDetail("run_x", "user_1");
    expect(result).toBeNull();

    const where = mocks.runFindFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: "run_x", project: { ownerId: "user_1" } });
  });

  it("getRunAuditTrail returns [] and never reads audit logs for a non-owned run", async () => {
    mocks.runFindFirst.mockResolvedValue(null); // ownership fence fails
    const trail = await getRunAuditTrail("run_x", "user_2");
    expect(trail).toEqual([]);
    expect(mocks.auditFindMany).not.toHaveBeenCalled();

    const where = mocks.runFindFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: "run_x", project: { ownerId: "user_2" } });
  });

  it("getRunAuditTrail reads logs only after the ownership fence passes", async () => {
    mocks.runFindFirst.mockResolvedValue({ id: "run_x" });
    mocks.auditFindMany.mockResolvedValue([]);
    await getRunAuditTrail("run_x", "user_1");
    expect(mocks.auditFindMany).toHaveBeenCalledTimes(1);
    const where = mocks.auditFindMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ entity: "AgentRun", entityId: "run_x" });
  });
});
