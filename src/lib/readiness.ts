import IORedis from "ioredis";
import { db } from "@/lib/db";
import { getQueueConfig } from "@/queue/config";

/**
 * Dependency readiness probes for GET /api/ready.
 *
 * Both probes resolve to a boolean and NEVER throw — the route maps them to a
 * generic "ok" | "error" with no messages, stack traces, or connection strings.
 */

/** Postgres liveness: a trivial `SELECT 1`. */
export async function checkDatabase(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Redis liveness using a DEDICATED short-lived client — never the long-lived
 * producer/Queue connection. It connects lazily, issues a single PING, fails
 * fast (no offline queue, no repeated retries), and is always disconnected.
 */
export async function checkRedis(): Promise<boolean> {
  const client = new IORedis(getQueueConfig().redisUrl, {
    connectTimeout: 1500,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    lazyConnect: true,
  });
  try {
    await client.connect();
    const res = await client.ping();
    return res === "PONG";
  } catch {
    return false;
  } finally {
    client.disconnect();
  }
}
