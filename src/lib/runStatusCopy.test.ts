import { describe, it, expect } from "vitest";
import { runStatusCopy, isEnqueueFailure } from "@/lib/runStatusCopy";

describe("runStatusCopy", () => {
  it("QUEUED with no retries waits for a worker", () => {
    const c = runStatusCopy({ status: "QUEUED", retryCount: 0 });
    expect(c.detail).toMatch(/waiting for a worker/i);
    expect(c.tone).toBe("pending");
  });

  it("QUEUED after a retry says retrying", () => {
    const c = runStatusCopy({ status: "QUEUED", retryCount: 1 });
    expect(c.detail).toMatch(/retrying/i);
  });

  it("RUNNING shows attempt = retryCount + 1 (never raw retryCount)", () => {
    expect(runStatusCopy({ status: "RUNNING", retryCount: 0 }).detail).toBe(
      "Running attempt 1."
    );
    expect(runStatusCopy({ status: "RUNNING", retryCount: 2 }).detail).toBe(
      "Running attempt 3."
    );
  });

  it("COMPLETED says completed and evaluated", () => {
    const c = runStatusCopy({ status: "COMPLETED", retryCount: 0 });
    expect(c.detail).toMatch(/completed and evaluated/i);
    expect(c.tone).toBe("success");
  });

  it("FAILED with retries uses retryCount + 1 as the attempt total", () => {
    expect(runStatusCopy({ status: "FAILED", retryCount: 2 }).detail).toBe(
      "Failed after 3 attempts."
    );
  });

  it("FAILED with retryCount 0 never claims determinism", () => {
    const c = runStatusCopy({ status: "FAILED", retryCount: 0 });
    expect(c.detail).toBe("Failed before another attempt was scheduled.");
    expect(c.detail.toLowerCase()).not.toContain("deterministic");
  });

  it("FAILED is only labelled non-retryable with a persisted signal", () => {
    // retryCount 0 alone → safe copy
    expect(
      runStatusCopy({ status: "FAILED", retryCount: 0 }).detail
    ).not.toMatch(/non-retryable/i);
    // persisted retryable:false → may say non-retryable
    expect(
      runStatusCopy({ status: "FAILED", retryCount: 0, retryable: false }).detail
    ).toMatch(/non-retryable/i);
    // retryable:true is not treated as non-retryable
    expect(
      runStatusCopy({ status: "FAILED", retryCount: 0, retryable: true }).detail
    ).not.toMatch(/non-retryable/i);
  });

  it("detects enqueue failure from the persisted failureReason", () => {
    const c = runStatusCopy({
      status: "FAILED",
      retryCount: 0,
      failureReason: "Queue enqueue failed: ECONNREFUSED",
    });
    expect(c.label).toMatch(/enqueue/i);
    expect(isEnqueueFailure("Queue enqueue failed: x")).toBe(true);
    expect(isEnqueueFailure("Code Search step failed")).toBe(false);
  });

  it('never uses "of M" phrasing or "exactly-once"', () => {
    for (const status of ["QUEUED", "RUNNING", "COMPLETED", "FAILED", "RETRIED"]) {
      for (const retryCount of [0, 1, 3]) {
        const c = runStatusCopy({ status, retryCount });
        expect(c.detail.toLowerCase()).not.toMatch(/ of \d/);
        expect(c.detail.toLowerCase()).not.toContain("exactly-once");
      }
    }
  });
});
