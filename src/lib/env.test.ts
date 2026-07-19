import { describe, it, expect, vi } from "vitest";
import { collectEnvErrors, validateWorkerEnv, checkWebEnv } from "@/lib/env";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  AUTH_SECRET: "secret",
  REDIS_URL: "redis://localhost:6379",
  AI_PROVIDER: "mock",
};

describe("collectEnvErrors", () => {
  it("passes with a valid mock web config", () => {
    expect(collectEnvErrors(base, "web")).toEqual([]);
  });

  it("passes with a valid mock worker config", () => {
    expect(collectEnvErrors(base, "worker")).toEqual([]);
  });

  it("requires DATABASE_URL in both contexts", () => {
    const { DATABASE_URL, ...rest } = base;
    void DATABASE_URL;
    expect(collectEnvErrors(rest, "web").join()).toContain("DATABASE_URL");
    expect(collectEnvErrors(rest, "worker").join()).toContain("DATABASE_URL");
  });

  it("requires AUTH_SECRET for web but not worker", () => {
    const { AUTH_SECRET, ...rest } = base;
    void AUTH_SECRET;
    expect(collectEnvErrors(rest, "web").join()).toContain("AUTH_SECRET");
    expect(collectEnvErrors(rest, "worker").join()).not.toContain("AUTH_SECRET");
  });

  it("requires REDIS_URL for worker but not web", () => {
    const { REDIS_URL, ...rest } = base;
    void REDIS_URL;
    expect(collectEnvErrors(rest, "worker").join()).toContain("REDIS_URL");
    expect(collectEnvErrors(rest, "web").join()).not.toContain("REDIS_URL");
  });

  it("requires OPENAI_API_KEY only when AI_PROVIDER=openai", () => {
    const openaiNoKey = { ...base, AI_PROVIDER: "openai" };
    expect(collectEnvErrors(openaiNoKey, "web").join()).toContain("OPENAI_API_KEY");
    const openaiWithKey = { ...openaiNoKey, OPENAI_API_KEY: "sk-test" };
    expect(collectEnvErrors(openaiWithKey, "web")).toEqual([]);
  });

  it("rejects an unknown AI_PROVIDER", () => {
    expect(collectEnvErrors({ ...base, AI_PROVIDER: "anthropic" }, "web").join()).toContain(
      "AI_PROVIDER"
    );
  });

  it("rejects a half-configured GitHub OAuth pair", () => {
    const idOnly = { ...base, AUTH_GITHUB_ID: "x" };
    expect(collectEnvErrors(idOnly, "web").join()).toContain("AUTH_GITHUB");
    const both = { ...base, AUTH_GITHUB_ID: "x", AUTH_GITHUB_SECRET: "y" };
    expect(collectEnvErrors(both, "web")).toEqual([]);
  });

  it("rejects an invalid explicit numeric but accepts unset", () => {
    expect(collectEnvErrors({ ...base, AGENT_RUN_MAX_ATTEMPTS: "0" }, "web").join()).toContain(
      "AGENT_RUN_MAX_ATTEMPTS"
    );
    expect(collectEnvErrors({ ...base, AGENT_RUN_MAX_ATTEMPTS: "3" }, "web")).toEqual([]);
    // backoff may be 0
    expect(collectEnvErrors({ ...base, AGENT_RUN_BACKOFF_MS: "0" }, "web")).toEqual([]);
  });

  it("never includes secret VALUES in messages", () => {
    const bad = { AI_PROVIDER: "openai", OPENAI_API_KEY: "" } as Record<string, string>;
    const msg = collectEnvErrors(bad, "worker").join("\n");
    expect(msg).not.toContain("postgresql://");
  });
});

describe("validateWorkerEnv", () => {
  it("exits non-zero on invalid config", () => {
    const exit = vi.fn();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    validateWorkerEnv({}, exit as unknown as (c: number) => never);
    expect(exit).toHaveBeenCalledWith(1);
    err.mockRestore();
  });

  it("does not exit on valid config", () => {
    const exit = vi.fn();
    validateWorkerEnv(base, exit as unknown as (c: number) => never);
    expect(exit).not.toHaveBeenCalled();
  });
});

describe("checkWebEnv", () => {
  it("returns warnings without throwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => checkWebEnv({})).not.toThrow();
    expect(checkWebEnv({}).length).toBeGreaterThan(0);
    warn.mockRestore();
  });
});
