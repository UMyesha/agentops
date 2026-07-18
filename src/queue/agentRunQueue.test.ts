import { describe, it, expect, beforeEach, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-explicit-any */

const added: any[] = [];

// Mock BullMQ Queue so no Redis is needed; capture add() calls.
vi.mock("bullmq", () => ({
  Queue: class {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    async add(jobName: string, data: any, opts: any) {
      added.push({ jobName, data, opts });
      return { id: opts?.jobId };
    }
  },
}));
vi.mock("@/queue/connection", () => ({
  getProducerConnection: () => ({}),
}));

const { enqueueAgentRun, defaultJobOptions, AGENT_RUN_QUEUE_NAME } = await import(
  "@/queue/agentRunQueue"
);

beforeEach(() => {
  added.length = 0;
});

describe("agentRunQueue", () => {
  it("uses a stable queue name", () => {
    expect(AGENT_RUN_QUEUE_NAME).toBe("agent-runs");
  });

  it("defaultJobOptions has bounded attempts + exponential backoff + retention", () => {
    const opts = defaultJobOptions();
    expect(opts.attempts).toBeGreaterThanOrEqual(1);
    expect(opts.backoff).toMatchObject({ type: "exponential" });
    expect(opts.removeOnComplete).toBeTruthy();
    expect(opts.removeOnFail).toBeTruthy();
  });

  it("enqueues with jobId === runId and the stable payload", async () => {
    await enqueueAgentRun({ runId: "run_abc", userId: "user_1" });

    expect(added).toHaveLength(1);
    const call = added[0];
    expect(call.data).toEqual({ runId: "run_abc", userId: "user_1" });
    expect(call.opts.jobId).toBe("run_abc"); // jobId = runId (dedup)
    expect(call.opts.attempts).toBeGreaterThanOrEqual(1);
  });

  it("payload carries only stable identifiers (no workflow/repo blobs)", async () => {
    await enqueueAgentRun({ runId: "r", userId: "u" });
    expect(Object.keys(added[0].data).sort()).toEqual(["runId", "userId"]);
  });
});
