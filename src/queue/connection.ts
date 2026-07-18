import IORedis, { type RedisOptions } from "ioredis";
import { getQueueConfig } from "@/queue/config";

// BullMQ requires `maxRetriesPerRequest: null` on its Redis connections.
const baseOptions: RedisOptions = {
  maxRetriesPerRequest: null,
};

/**
 * Create a NEW ioredis connection. Used by the standalone worker, which must
 * own its own connection (never the web-process singleton).
 */
export function makeRedisConnection(): IORedis {
  return new IORedis(getQueueConfig().redisUrl, baseOptions);
}

// Producer-side singleton for the Next.js process, guarded against dev hot
// reload so HMR doesn't leak a new Redis client on every reload (same pattern
// as src/lib/db.ts).
const globalForRedis = globalThis as unknown as {
  agentRunRedis: IORedis | undefined;
};

export function getProducerConnection(): IORedis {
  if (!globalForRedis.agentRunRedis) {
    globalForRedis.agentRunRedis = new IORedis(
      getQueueConfig().redisUrl,
      baseOptions
    );
  }
  return globalForRedis.agentRunRedis;
}
