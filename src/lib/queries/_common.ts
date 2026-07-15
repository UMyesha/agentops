import { auth } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

/**
 * Returns the signed-in user's id, or null if unauthenticated.
 * Used by server components — pages redirect via the (app) layout gate, so a
 * null here in a page means the session expired mid-request.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * For API routes: returns the user id or throws a 401-shaped error the route
 * helper (src/lib/api.ts) converts into a response. (Used in Phase 2B routes.)
 */
export async function requireUserId(): Promise<string> {
  const id = await getSessionUserId();
  if (!id) {
    const err = new Error("Unauthorized") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return id;
}

/**
 * Reusable `where` fragment scoping any AgentRun query to runs the user owns
 * (i.e. runs whose project belongs to them). Keeps authorization in one place.
 */
export function ownedRunWhere(userId: string): Prisma.AgentRunWhereInput {
  return { project: { ownerId: userId } };
}
