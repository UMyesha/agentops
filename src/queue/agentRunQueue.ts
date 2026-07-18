import { Queue, type JobsOptions } from "bullmq";
import { getProducerConnection } from "@/queue/connection";
import { getQueueConfig } from "@/queue/config";

/** Stable queue name — shared by the producer (web) and the worker. */
export const AGENT_RUN_QUEUE_NAME = "agent-runs";

/**
 * Job payload: stable identifiers ONLY. The worker loads all authoritative data
 * (run, workflow, ownership, agents, prompts, request) from Postgres — the
 * workflow definition and repo context never go into Redis.
 */
export interface AgentRunJob {
  runId: string;
  userId: string;
}

/** BullMQ retry/retention policy, derived from validated config. */
export function defaultJobOptions(): JobsOptions {
  const cfg = getQueueConfig();
  return {
    attempts: cfg.maxAttempts,
    backoff: { type: "exponential", delay: cfg.backoffMs },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  };
}

// Producer Queue singleton (web process), hot-reload guarded.
const globalForQueue = globalThis as unknown as {
  agentRunQueue: Queue<AgentRunJob> | undefined;
};

export function getAgentRunQueue(): Queue<AgentRunJob> {
  if (!globalForQueue.agentRunQueue) {
    globalForQueue.agentRunQueue = new Queue<AgentRunJob>(AGENT_RUN_QUEUE_NAME, {
      connection: getProducerConnection(),
    });
  }
  return globalForQueue.agentRunQueue;
}

/**
 * Enqueue one job for a run. `jobId = runId` dedups enqueues for the same run.
 * Throws if Redis/enqueue fails — the caller (POST route) converts that into a
 * 503 and marks the run FAILED so it is never left indefinitely QUEUED.
 */
export async function enqueueAgentRun(job: AgentRunJob) {
  return getAgentRunQueue().add("run", job, {
    ...defaultJobOptions(),
    jobId: job.runId,
  });
}
