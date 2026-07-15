import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  FolderKanban,
  Wrench,
  ChevronDown,
} from "lucide-react";
import { getSessionUserId } from "@/lib/queries/_common";
import { getWorkflowById, listTools } from "@/lib/queries/workflows";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RunsTable } from "@/components/runs/RunsTable";
import { PromptVersionList } from "@/components/prompts/PromptVersionList";

function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const [workflow, tools] = await Promise.all([
    getWorkflowById(id, userId),
    listTools(),
  ]);
  if (!workflow) notFound();

  return (
    <div className="space-y-6">
      <Link
        href={`/projects/${workflow.project.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {workflow.project.name}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {workflow.name}
        </h1>
        {workflow.description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {workflow.description}
          </p>
        )}
        <Link
          href={`/projects/${workflow.project.id}`}
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <FolderKanban className="size-3.5" />
          {workflow.project.name}
        </Link>
      </div>

      {/* Agents */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Agents ({workflow.agents.length})
        </h2>
        <ol className="space-y-2">
          {workflow.agents.map((agent) => (
            <li key={agent.id}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold tabular-nums">
                      {agent.order}
                    </span>
                    <span className="font-medium">{agent.name}</span>
                    <Badge variant="secondary">{roleLabel(agent.role)}</Badge>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      {agent.model}
                    </span>
                  </div>
                  {agent.description && (
                    <p className="mt-2 pl-9 text-sm text-muted-foreground">
                      {agent.description}
                    </p>
                  )}
                  <details className="group mt-3 pl-9">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                      <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                      Prompt versions ({agent.promptVersions.length})
                    </summary>
                    <div className="mt-2">
                      <PromptVersionList versions={agent.promptVersions} />
                    </div>
                  </details>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* Tools */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Available tools ({tools.length})
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Card key={tool.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Wrench className="size-3.5 text-muted-foreground" />
                  <code className="font-mono text-sm font-medium">
                    {tool.name}
                  </code>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {tool.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Run history */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Run history
        </h2>
        <RunsTable runs={workflow.runs} />
      </section>
    </div>
  );
}
