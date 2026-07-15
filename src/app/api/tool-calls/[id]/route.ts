import { withUser } from "@/lib/api";
import { getToolCallById } from "@/lib/queries/toolCalls";

// GET /api/tool-calls/:id
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withUser((userId) => getToolCallById(id, userId));
}
