import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSessionUserId: vi.fn() }));
vi.mock("@/lib/queries/_common", () => ({
  getSessionUserId: mocks.getSessionUserId,
}));

const { withUser } = await import("@/lib/api");

beforeEach(() => mocks.getSessionUserId.mockReset());

describe("withUser (no secret / internal leakage)", () => {
  it("401 with a generic body when unauthenticated", async () => {
    mocks.getSessionUserId.mockResolvedValue(null);
    const res = await withUser(async () => ({ ok: true }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("404 when the handler resolves null (missing or not owned)", async () => {
    mocks.getSessionUserId.mockResolvedValue("user_1");
    const res = await withUser(async () => null);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Not found" });
  });

  it("500 hides the underlying error message (no internal detail leaked)", async () => {
    mocks.getSessionUserId.mockResolvedValue("user_1");
    const secret = "postgresql://user:password@db:5432/secret";
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await withUser(async () => {
      throw new Error(`connection failed: ${secret}`);
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Internal error" });
    expect(JSON.stringify(body)).not.toContain(secret);
    errSpy.mockRestore();
  });

  it("returns the handler payload on success", async () => {
    mocks.getSessionUserId.mockResolvedValue("user_1");
    const res = await withUser(async () => ({ hello: "world" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ hello: "world" });
  });
});
