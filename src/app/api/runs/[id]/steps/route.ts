import { withUser } from "@/lib/api";
import { getRunDetail } from "@/lib/queries/runs";

// GET /api/runs/:id/steps — reuses getRunDetail (no duplicated Prisma query).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withUser(async (userId) => {
    const run = await getRunDetail(id, userId);
    return run ? { steps: run.steps } : null;
  });
}
