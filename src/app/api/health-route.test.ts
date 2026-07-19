import { describe, it, expect } from "vitest";
import { GET, runtime, dynamic } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns 200 { status: 'ok' }", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });

  it("is configured as a dynamic nodejs route", () => {
    expect(runtime).toBe("nodejs");
    expect(dynamic).toBe("force-dynamic");
  });

  it("body contains no secret-shaped values", async () => {
    const res = GET();
    const text = JSON.stringify(await res.json());
    expect(text).not.toMatch(/postgres|redis:\/\/|sk-|AUTH_SECRET/i);
  });
});
