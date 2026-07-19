import { NextResponse } from "next/server";

// Liveness only — never touches a dependency or a secret. A 200 means the web
// process is up and serving; it says nothing about Postgres/Redis (see /api/ready).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" });
}
