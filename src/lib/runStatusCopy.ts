/**
 * Human-readable run status copy derived ONLY from persisted signals.
 *
 * Hard rules (Phase 6 correction #3):
 *  - `retryCount` records RETRIES, not total executions. Any attempt total is
 *    `retryCount + 1` — never the raw `retryCount`.
 *  - Never infer intent from the current environment (no "attempt N of M" — the
 *    historical max is not persisted per run).
 *  - `retryCount === 0` does NOT prove a deterministic failure. A failure may be
 *    labelled non-retryable ONLY when a persisted structured signal
 *    (`retryable === false`, sourced from audit metadata) proves it.
 */

export type RunTone = "pending" | "active" | "success" | "error";

export interface RunStatusCopy {
  /** Short status label. */
  label: string;
  /** One-line explanation safe to show to the user. */
  detail: string;
  tone: RunTone;
}

export interface RunStatusInput {
  status: string;
  /** Persisted retry count (number of retries, not attempts). */
  retryCount: number;
  failureReason?: string | null;
  /**
   * Optional persisted signal from `run.worker_failed` audit metadata:
   * true = failed after a retryable error was exhausted; false = the error was
   * non-retryable. Undefined/null when no such signal was recorded.
   */
  retryable?: boolean | null;
}

const ENQUEUE_FAILURE_PREFIX = "Queue enqueue failed";

/** True when a FAILED run failed because the job could not be enqueued. */
export function isEnqueueFailure(failureReason?: string | null): boolean {
  return !!failureReason && failureReason.startsWith(ENQUEUE_FAILURE_PREFIX);
}

export function runStatusCopy(run: RunStatusInput): RunStatusCopy {
  const attempts = run.retryCount + 1; // total executions, never raw retryCount

  switch (run.status) {
    case "QUEUED":
      return run.retryCount > 0
        ? {
            label: "Retrying",
            detail: "Retrying after a transient failure — waiting for a worker.",
            tone: "pending",
          }
        : {
            label: "Queued",
            detail: "Waiting for a worker to pick up this run.",
            tone: "pending",
          };

    case "RUNNING":
      return {
        label: "Running",
        detail: `Running attempt ${attempts}.`,
        tone: "active",
      };

    case "COMPLETED":
      return {
        label: "Completed",
        detail: "Completed and evaluated.",
        tone: "success",
      };

    case "FAILED": {
      if (isEnqueueFailure(run.failureReason)) {
        return {
          label: "Enqueue failed",
          detail:
            "Couldn't queue the run — the execution service may be unavailable.",
          tone: "error",
        };
      }
      if (run.retryCount > 0) {
        return {
          label: "Failed",
          detail: `Failed after ${attempts} attempts.`,
          tone: "error",
        };
      }
      // retryCount === 0 → exactly one execution. Only claim non-retryable when a
      // persisted signal proves it; otherwise stay with the safe wording.
      if (run.retryable === false) {
        return {
          label: "Failed",
          detail: "Failed on a non-retryable error; no retry was attempted.",
          tone: "error",
        };
      }
      return {
        label: "Failed",
        detail: "Failed before another attempt was scheduled.",
        tone: "error",
      };
    }

    case "RETRIED":
      return {
        label: "Retried",
        detail: "Superseded by a retry run.",
        tone: "pending",
      };

    default:
      return { label: run.status, detail: "", tone: "pending" };
  }
}
