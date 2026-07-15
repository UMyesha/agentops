import { withUser } from "@/lib/api";
import { listProjects } from "@/lib/queries/projects";

// GET /api/projects — all projects owned by the signed-in user.
export async function GET() {
  return withUser((userId) => listProjects(userId));
}
