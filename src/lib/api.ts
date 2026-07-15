import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/queries/_common";

/**
 * Wraps a read-only API handler with auth + error handling so every GET route
 * behaves consistently:
 *  - 401 when unauthenticated
 *  - 404 when the handler resolves null/undefined (resource missing or not owned)
 *  - 500 on unexpected errors
 * The handler itself only ever calls the shared query layer — no route
 * duplicates Prisma query logic.
 */
export async function withUser<T>(
  handler: (userId: string) => Promise<T>
): Promise<NextResponse> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const data = await handler(userId);
    if (data === null || data === undefined) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api] handler error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
