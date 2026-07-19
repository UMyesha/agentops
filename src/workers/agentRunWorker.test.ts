import { describe, it, expect, vi } from "vitest";
import type { RunOutcome } from "@/agents/runner";

/* eslint-disable @typescript-eslint/no-explicit-any */

// main() is guarded off under Vitest, so importing the worker doesn't construct
// a real Worker or connect to Redis.
const { handleJob } = await import("@/workers/agentRunWorker");

function fakeJob(overrides: Partial<any> = {}) {
  return {
    id: "run_1",
    data: { runId: "run_1", userId: "user_1" },
    attemptsMade: 0,
    attemptsStarted: 1,
    extendLock: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as any;
}

const exec = (outcome: RunOutcome) => vi.fn().mockResolvedValue(outcome);

describe("worker handleJob", () => {
  it("aborts before any execution when the token is missing/empty", async () => {
    const execute = exec({ kind: "completed", runId: "run_1" });
    await expect(handleJob(fakeJob(), undefined, execute)).rejects.toThrow(
      /without a lock token/
    );
    await expect(handleJob(fakeJob(), "", execute)).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled(); // no DB mutation attempted
  });

  it("throws for a 'retry' outcome (BullMQ will retry)", async () => {
    const execute = exec({
      kind: "retry",
      runId: "run_1",
      retryAttempt: 1,
      maxAttempts: 3,
    });
    await expect(handleJob(fakeJob(), "tok", execute)).rejects.toBeTruthy();
  });

  it("throws for a 'retry_exhausted' outcome (records job failed)", async () => {
    const execute = exec({ kind: "retry_exhausted", runId: "run_1" });
    await expect(handleJob(fakeJob(), "tok", execute)).rejects.toBeTruthy();
  });

  it("returns (no throw) for completed / failed_business / noop", async () => {
    await expect(
      handleJob(fakeJob(), "tok", exec({ kind: "completed", runId: "run_1" }))
    ).resolves.toBeUndefined();
    await expect(
      handleJob(fakeJob(), "tok", exec({ kind: "failed_business", runId: "run_1" }))
    ).resolves.toBeUndefined();
    await expect(
      handleJob(fakeJob(), "tok", exec({ kind: "noop", runId: "run_1", reason: "x" }))
    ).resolves.toBeUndefined();
  });

  it("passes retryAttempt = attemptsMade+1 and activation = attemptsStarted", async () => {
    const execute = exec({ kind: "completed", runId: "run_1" });
    await handleJob(
      fakeJob({ attemptsMade: 2, attemptsStarted: 4 }),
      "tok",
      execute
    );
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ retryAttempt: 3, activation: 4 })
    );
  });

  // retryAttempt is the CANONICAL 1-based execution attempt number persisted in
  // audit metadata; the UI renders it as-is. A first activation must be 1 (not 0
  // and not 2), and attemptsStarted must never receive an extra increment.
  it("first activation yields retryAttempt 1 (never 0) and activation 1", async () => {
    const execute = exec({ kind: "completed", runId: "run_1" });
    await handleJob(fakeJob({ attemptsMade: 0, attemptsStarted: 1 }), "tok", execute);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ retryAttempt: 1, activation: 1 })
    );
  });

  it("attempt numbers advance 1 → 2 → 3 across retries", async () => {
    for (const [attemptsMade, expected] of [
      [0, 1],
      [1, 2],
      [2, 3],
    ] as const) {
      const execute = exec({ kind: "completed", runId: "run_1" });
      await handleJob(fakeJob({ attemptsMade }), "tok", execute);
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({ retryAttempt: expected })
      );
    }
  });

  it("does not add an extra increment to attemptsStarted", async () => {
    const execute = exec({ kind: "completed", runId: "run_1" });
    await handleJob(fakeJob({ attemptsMade: 0, attemptsStarted: 3 }), "tok", execute);
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ activation: 3 })
    );
  });

  it("supplies a verifyLock that extends the BullMQ lock", async () => {
    const job = fakeJob();
    const execute = vi.fn(async (opts: any) => {
      // Exercise the fence the worker provides.
      const ok = await opts.verifyLock();
      expect(ok).toBe(true);
      return { kind: "completed", runId: "run_1" } as RunOutcome;
    });
    await handleJob(job, "tok", execute);
    expect(job.extendLock).toHaveBeenCalledWith("tok", expect.any(Number));
  });
});
