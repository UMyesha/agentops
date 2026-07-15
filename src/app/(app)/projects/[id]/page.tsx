import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Workflow as WorkflowIcon, Activity } from "lucide-react";
import { getSessionUserId } from "@/lib/queries/_common";
import { getProjectById } from "@/lib/queries/projects";
import { Card, CardContent } from "@/components/ui/card";
import { RunsTable } from "@/components/runs/RunsTable";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const project = await getProjectById(id, userId);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to projects
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {project.name}
        </h1>
        {project.description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {project.description}
          </p>
        )}
      </div>

      {/* Workflows */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Workflows
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {project.workflows.map((w) => (
            <Link key={w.id} href={`/workflows/${w.id}`}>
              <Card className="transition-colors hover:border-primary/40 hover:bg-muted/40">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <WorkflowIcon className="size-4 text-muted-foreground" />
                    <span className="font-medium">{w.name}</span>
                  </div>
                  {w.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {w.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{w._count.agents} agents</span>
                    <span className="inline-flex items-center gap-1">
                      <Activity className="size-3.5" />
                      {w._count.runs} runs
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Run history */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent runs
        </h2>
        <RunsTable runs={project.runs} />
      </section>
    </div>
  );
}
