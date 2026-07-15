import { withUser } from "@/lib/api";
import { getProjectById } from "@/lib/queries/projects";

// GET /api/projects/:id/workflows — reuses getProjectById (which includes
// workflows) rather than duplicating a Prisma query. 404 if project not owned.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withUser(async (userId) => {
    const project = await getProjectById(id, userId);
    return project ? { workflows: project.workflows } : null;
  });
}
