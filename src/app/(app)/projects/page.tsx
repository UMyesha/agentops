import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, Workflow as WorkflowIcon, Activity } from "lucide-react";
import { getSessionUserId } from "@/lib/queries/_common";
import { listProjects } from "@/lib/queries/projects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { timeAgo } from "@/lib/utils";

export default async function ProjectsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const projects = await listProjects(userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground">
          Workspaces that group your workflows and runs.
        </p>
      </div>

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="A seeded demo project appears here once the database is seeded (npm run db:seed)."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`}>
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/40">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <FolderKanban className="size-4 text-muted-foreground" />
                    <CardTitle className="text-base">{p.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {p.description ?? "No description."}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <WorkflowIcon className="size-3.5" />
                      {p._count.workflows} workflows
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Activity className="size-3.5" />
                      {p._count.runs} runs
                    </span>
                    <span className="ml-auto">{timeAgo(p.createdAt)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
