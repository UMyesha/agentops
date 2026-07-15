import { withUser } from "@/lib/api";
import { getRunDetail } from "@/lib/queries/runs";

// GET /api/runs/:id/tool-calls — flattens the run's step tool calls.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withUser(async (userId) => {
    const run = await getRunDetail(id, userId);
    return run
      ? { toolCalls: run.steps.flatMap((s) => s.toolCalls) }
      : null;
  });
}
