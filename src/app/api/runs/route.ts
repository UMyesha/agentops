import { RunStatus } from "@prisma/client";
import { withUser } from "@/lib/api";
import { listRuns } from "@/lib/queries/runs";

const VALID = new Set<string>(Object.values(RunStatus));

// GET /api/runs?status=FAILED
export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  const filter = status && VALID.has(status) ? (status as RunStatus) : undefined;
  return withUser((userId) => listRuns(userId, { status: filter }));
}
