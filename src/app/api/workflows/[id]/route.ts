import { withUser } from "@/lib/api";
import { getWorkflowById } from "@/lib/queries/workflows";

// GET /api/workflows/:id
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withUser((userId) => getWorkflowById(id, userId));
}
