// Validated queue/worker configuration, read once from the environment with
// safe local-development defaults. This is the single source of truth for the
// retry policy, the worker lock duration, and the retry-test-trigger gate.

function intEnv(name: string, fallback: number, min = 1): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min) return fallback;
  return n;
}

export interface QueueConfig {
  redisUrl: string;
  maxAttempts: number;
  backoffMs: number;
  concurrency: number;
  /** BullMQ Worker({ lockDuration }); also the value passed to job.extendLock. */
  lockDurationMs: number;
}

export function getQueueConfig(): QueueConfig {
  return {
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    maxAttempts: intEnv("AGENT_RUN_MAX_ATTEMPTS", 3, 1),
    backoffMs: intEnv("AGENT_RUN_BACKOFF_MS", 1000, 0),
    concurrency: intEnv("AGENT_WORKER_CONCURRENCY", 2, 1),
    lockDurationMs: intEnv("AGENT_WORKER_LOCK_DURATION_MS", 30000, 1000),
  };
}

/**
 * Whether the synthetic retryable-failure phrases in the mock provider are
 * active. Gated so ordinary mock requests and production can NEVER trip
 * synthetic transient failures. The single decision point for the gate.
 *
 * Active only when AI_PROVIDER=mock AND AGENTOPS_ENABLE_RETRY_TEST_TRIGGERS=true
 * (default false).
 */
export function retryTriggersEnabled(): boolean {
  const provider = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  const flag = (process.env.AGENTOPS_ENABLE_RETRY_TEST_TRIGGERS ?? "false").toLowerCase();
  return provider === "mock" && flag === "true";
}
