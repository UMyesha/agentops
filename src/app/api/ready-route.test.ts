import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkDatabase: vi.fn(),
  checkRedis: vi.fn(),
}));

vi.mock("@/lib/readiness", () => ({
  checkDatabase: mocks.checkDatabase,
  checkRedis: mocks.checkRedis,
}));

const { GET, runtime, dynamic } = await import("@/app/api/ready/route");

beforeEach(() => {
  mocks.checkDatabase.mockReset();
  mocks.checkRedis.mockReset();
});

describe("GET /api/ready", () => {
  it("is configured as a dynamic nodejs route", () => {
    expect(runtime).toBe("nodejs");
    expect(dynamic).toBe("force-dynamic");
  });

  it("200 with both ok when all dependencies pass", async () => {
    mocks.checkDatabase.mockResolvedValue(true);
    mocks.checkRedis.mockResolvedValue(true);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ db: "ok", redis: "ok" });
  });

  it("503 with redis error when Redis is unavailable", async () => {
    mocks.checkDatabase.mockResolvedValue(true);
    mocks.checkRedis.mockResolvedValue(false);
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ db: "ok", redis: "error" });
  });

  it("503 with db error when Postgres is unavailable", async () => {
    mocks.checkDatabase.mockResolvedValue(false);
    mocks.checkRedis.mockResolvedValue(true);
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ db: "error", redis: "ok" });
  });

  it("503 with both error when everything is down", async () => {
    mocks.checkDatabase.mockResolvedValue(false);
    mocks.checkRedis.mockResolvedValue(false);
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ db: "error", redis: "error" });
  });

  it("never leaks connection strings or messages in the body", async () => {
    mocks.checkDatabase.mockResolvedValue(false);
    mocks.checkRedis.mockResolvedValue(false);
    const res = await GET();
    const body = await res.json();
    const text = JSON.stringify(body);
    // The generic "error" status is allowed; connection details/messages are not.
    expect(text).not.toMatch(/postgres|redis:\/\/|localhost|ECONNREFUSED|stack|\bat\s/i);
    // Only the two generic keys, nothing else.
    expect(Object.keys(body).sort()).toEqual(["db", "redis"]);
  });
});
