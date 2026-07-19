/**
 * Standalone BullMQ worker — the ONLY place workflow execution happens.
 *
 * Run with `npm run worker` (a separate process from `npm run dev`). This file
 * must never be imported by a Next.js route, server component, or instrumentation
 * hook — importing it would construct a Worker inside the web process.
 *
 *   Terminal 1:  npm run dev
 *   Terminal 2:  npm run worker
 */
import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { makeRedisConnection } from "@/queue/connection";
import { getQueueConfig } from "@/queue/config";
import {
  AGENT_RUN_QUEUE_NAME,
  type AgentRunJob,
} from "@/queue/agentRunQueue";
import { executeExistingRun } from "@/agents/runner";
import { RetryableRunError } from "@/agents/errors";
import { validateWorkerEnv } from "@/lib/env";

const cfg = getQueueConfig();

function log(msg: string, extra?: Record<string, unknown>) {
  console.log(
    `[worker] ${msg}${extra ? " " + JSON.stringify(extra) : ""}`
  );
}

type ExecuteFn = typeof executeExistingRun;

/**
 * Handle one job: token abort → execute → translate the RunOutcome into BullMQ
 * semantics. Exported (with an injectable executor) so it can be unit-tested
 * without constructing a real Worker.
 */
export async function handleJob(
  job: Job<AgentRunJob>,
  token: string | undefined,
  execute: ExecuteFn = executeExistingRun
): Promise<void> {
  const { runId, userId } = job.data;

  // A missing/empty BullMQ token means we cannot fence ownership at all —
  // abort BEFORE any database mutation and let a healthy re-delivery handle it.
  if (!token) {
    throw new Error(
      `[worker] job ${job.id} delivered without a lock token; aborting before any DB mutation`
    );
  }

  const retryAttempt = job.attemptsMade + 1; // bounded FAILURE-retry number
  const activation = job.attemptsStarted ?? 1; // ++ on every activation incl. stalled

  log("worker_started", { runId, retryAttempt, activation });

  const outcome = await execute({
    runId,
    userId,
    retryAttempt,
    maxAttempts: cfg.maxAttempts,
    activation,
    backoffMs: cfg.backoffMs,
    // Best-effort ownership fence via the BullMQ lock. Uses the SAME lock
    // duration the Worker was constructed with. A throw or non-successful
    // extension is treated as loss of ownership.
    verifyLock: async () => {
      // BullMQ extendLock resolves with a non-zero value on a successful
      // extension and throws (LockError) if the lock is no longer owned.
      const res = await job.extendLock(token, cfg.lockDurationMs);
      return res !== 0;
    },
  });

  // Translate the run outcome into BullMQ semantics:
  //  - retry / retry_exhausted  → throw so BullMQ retries (attempts remain) or
  //    records the job as failed (attempts exhausted).
  //  - completed / failed_business / noop → return; the job completes. A
  //    business FAILED is a valid outcome (data), not a job error.
  if (outcome.kind === "retry" || outcome.kind === "retry_exhausted") {
    log(outcome.kind, { runId, retryAttempt });
    throw new RetryableRunError(
      `Run ${runId} ${outcome.kind} on attempt ${retryAttempt}/${cfg.maxAttempts}`
    );
  }

  log("worker_" + outcome.kind, { runId });
}

const processor = (job: Job<AgentRunJob>, token?: string) =>
  handleJob(job, token);

function main() {
  // Fail loudly on invalid required configuration before constructing a Worker.
  validateWorkerEnv();

  if (!cfg.redisUrl) {
    console.error("[worker] REDIS_URL is not configured; exiting.");
    process.exit(1);
  }

  const connection = makeRedisConnection();
  const worker = new Worker<AgentRunJob>(AGENT_RUN_QUEUE_NAME, processor, {
    connection,
    concurrency: cfg.concurrency,
    lockDuration: cfg.lockDurationMs,
  });

  worker.on("ready", () =>
    log("ready", {
      queue: AGENT_RUN_QUEUE_NAME,
      concurrency: cfg.concurrency,
      maxAttempts: cfg.maxAttempts,
    })
  );
  worker.on("failed", (job, err) =>
    log("job_failed", { jobId: job?.id, error: err.message })
  );
  worker.on("error", (err) => console.error("[worker] error:", err));

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`received ${signal}, shutting down gracefully…`);
    try {
      await worker.close();
      await connection.quit();
    } catch (err) {
      console.error("[worker] shutdown error:", err);
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  log("started", { redis: cfg.redisUrl.replace(/\/\/.*@/, "//***@") });
}

// Only start the worker when executed as a process — not when imported by tests.
if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
  main();
}
