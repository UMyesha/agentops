import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The seed executes and connects to Postgres on import, so it can't be run
// inside the mocked unit suite. Instead we assert the two properties that make
// reseeding safe and reproducible, statically over the seed source (CI-safe,
// no database): idempotent reset + no nondeterministic data.
const seedPath = fileURLToPath(new URL("../../prisma/seed.ts", import.meta.url));
const source = readFileSync(seedPath, "utf8");

describe("seed idempotency & determinism", () => {
  it("clears existing data before recreating (idempotent reseed)", () => {
    expect(source).toMatch(/deleteMany/);
  });

  it("uses no nondeterministic randomness in seeded data", () => {
    expect(source).not.toMatch(/Math\.random/);
    // No cuid()/uuid() literals sprinkled into data — Prisma assigns ids.
    expect(source).not.toMatch(/\brandomUUID\b/);
  });

  it("keeps the demo credentials as fixed constants", () => {
    // Deterministic demo login: email/password come from env or a fixed default,
    // never a random value.
    expect(source).toMatch(/DEMO_USER_EMAIL|demo@agentops\.dev/);
  });
});
