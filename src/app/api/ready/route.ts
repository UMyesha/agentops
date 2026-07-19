import { NextResponse } from "next/server";
import { checkDatabase, checkRedis } from "@/lib/readiness";

// Readiness: probes Postgres + Redis and returns per-dependency status. Reports
// only generic "ok" | "error" — never messages, stack traces, or connection
// strings. No enqueue, no mutation.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [dbOk, redisOk] = await Promise.all([checkDatabase(), checkRedis()]);

  const body = {
    db: dbOk ? "ok" : "error",
    redis: redisOk ? "ok" : "error",
  } as const;

  const status = dbOk && redisOk ? 200 : 503;
  return NextResponse.json(body, { status });
}
