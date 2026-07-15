import { withUser } from "@/lib/api";
import { getRunDetail } from "@/lib/queries/runs";

// GET /api/runs/:id — full run trace (steps, tool calls, evaluation, guardrails).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withUser((userId) => getRunDetail(id, userId));
}
