import { describe, it, expect } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RunAuditTrail } from "@/components/runs/RunAuditTrail";
import type { RunAuditEntry } from "@/lib/queries/runs";

/**
 * `retryAttempt` in audit metadata is the CANONICAL 1-based execution attempt
 * number (worker: `job.attemptsMade + 1`). The UI must render it as-is.
 * Regression guard for the off-by-one where a first execution (retryAttempt 1,
 * retryCount 0) incorrectly displayed "attempt 2".
 */
function entry(
  action: string,
  metadata: unknown = null,
  id = Math.random().toString(36).slice(2)
): RunAuditEntry {
  return { id, action, createdAt: new Date("2026-01-01T00:00:00Z"), metadata };
}

function render(entries: RunAuditEntry[]): string {
  return renderToStaticMarkup(React.createElement(RunAuditTrail, { entries }));
}

describe("RunAuditTrail attempt numbering", () => {
  it("first activation / zero retries displays attempt 1", () => {
    const html = render([entry("run.worker_started", { retryAttempt: 1, activation: 1 })]);
    expect(html).toContain("attempt 1");
    expect(html).not.toContain("attempt 2");
  });

  it("one retry displays attempt 2", () => {
    const html = render([entry("run.worker_started", { retryAttempt: 2, activation: 2 })]);
    expect(html).toContain("attempt 2");
    expect(html).not.toContain("attempt 3");
  });

  it("two retries displays attempt 3", () => {
    const html = render([entry("run.worker_started", { retryAttempt: 3, activation: 3 })]);
    expect(html).toContain("attempt 3");
    expect(html).not.toContain("attempt 4");
  });

  it("never renders attempt 0 for absent, zero, or invalid values", () => {
    const html = render([
      entry("run.worker_started", { retryAttempt: 0 }),
      entry("run.worker_started", { retryAttempt: "x" }),
      entry("run.worker_started", {}),
      entry("run.queued", null),
    ]);
    expect(html).not.toContain("attempt 0");
    expect(html).not.toContain("attempt");
  });

  it("renders a full retry sequence with correct, non-duplicated attempt numbers", () => {
    const html = render([
      entry("run.queued"),
      entry("run.worker_started", { retryAttempt: 1, activation: 1 }),
      entry("run.retry_scheduled", { retryAttempt: 1, maxAttempts: 3 }),
      entry("run.worker_started", { retryAttempt: 2, activation: 2 }),
      entry("run.retry_scheduled", { retryAttempt: 2, maxAttempts: 3 }),
      entry("run.worker_started", { retryAttempt: 3, activation: 3 }),
      entry("run.worker_failed", { reason: "boom", retryable: true }),
    ]);
    expect(html).toContain("attempt 1");
    expect(html).toContain("attempt 2");
    expect(html).toContain("attempt 3");
    expect(html).not.toContain("attempt 4");
    expect(html).not.toContain("attempt 0");
    // Terminal entry carries no retryAttempt → no attempt suffix on it.
    expect(html).toContain("Failed");
  });

  it("does not treat a raw retryCount field as the attempt total", () => {
    // retryCount stores RETRIES, not executions, and is not an attempt source here.
    const html = render([entry("run.worker_started", { retryCount: 2 })]);
    expect(html).not.toContain("attempt");
  });

  it("renders nothing when there is no audit trail", () => {
    expect(render([])).toBe("");
  });
});
