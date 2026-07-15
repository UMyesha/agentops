import { withUser } from "@/lib/api";
import { getProjectById } from "@/lib/queries/projects";

// GET /api/projects/:id
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withUser((userId) => getProjectById(id, userId));
}
