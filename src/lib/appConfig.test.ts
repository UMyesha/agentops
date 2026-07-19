import { describe, it, expect, afterEach, vi } from "vitest";

// The `server-only` marker throws under Vitest's react-server resolution; stub
// it so the module under test (which is genuinely server-only in the app) can be
// imported here. This does not weaken the build-time guarantee in Next.js.
vi.mock("server-only", () => ({}));

const { demoModeEnabled } = await import("@/lib/appConfig");

const original = process.env.AGENTOPS_DEMO_MODE;

afterEach(() => {
  if (original === undefined) delete process.env.AGENTOPS_DEMO_MODE;
  else process.env.AGENTOPS_DEMO_MODE = original;
});

describe("demoModeEnabled", () => {
  it("defaults to false when unset", () => {
    delete process.env.AGENTOPS_DEMO_MODE;
    expect(demoModeEnabled()).toBe(false);
  });

  it("is false for 'false'", () => {
    process.env.AGENTOPS_DEMO_MODE = "false";
    expect(demoModeEnabled()).toBe(false);
  });

  it("is true only for 'true' (case-insensitive)", () => {
    process.env.AGENTOPS_DEMO_MODE = "true";
    expect(demoModeEnabled()).toBe(true);
    process.env.AGENTOPS_DEMO_MODE = "TRUE";
    expect(demoModeEnabled()).toBe(true);
  });

  it("is false for arbitrary values", () => {
    process.env.AGENTOPS_DEMO_MODE = "yes";
    expect(demoModeEnabled()).toBe(false);
    process.env.AGENTOPS_DEMO_MODE = "1";
    expect(demoModeEnabled()).toBe(false);
  });
});
