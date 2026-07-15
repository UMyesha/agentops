import { withUser } from "@/lib/api";
import { getRunDetail } from "@/lib/queries/runs";

// GET /api/runs/:id/evaluation — evaluation may be null for a run that exists
// (e.g. a failed run), so we wrap it: 404 only means the run wasn't found.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withUser(async (userId) => {
    const run = await getRunDetail(id, userId);
    return run ? { evaluation: run.evaluation } : null;
  });
}
