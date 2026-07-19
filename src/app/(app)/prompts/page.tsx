import Link from "next/link";
import { redirect } from "next/navigation";
import { GitBranch } from "lucide-react";
import { getSessionUserId } from "@/lib/queries/_common";
import {
  listPromptVersionsByAgent,
  type AgentWithPrompts,
} from "@/lib/queries/prompts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { PromptVersionList } from "@/components/prompts/PromptVersionList";

function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export default async function PromptsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const agents = await listPromptVersionsByAgent(userId);

  // Group agents under their workflow.
  const groups = new Map<
    string,
    { name: string; agents: AgentWithPrompts[] }
  >();
  for (const agent of agents) {
    const g = groups.get(agent.workflow.id) ?? {
      name: agent.workflow.name,
      agents: [],
    };
    g.agents.push(agent);
    groups.set(agent.workflow.id, g);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Prompt Versions
        </h1>
        <p className="text-sm text-muted-foreground">
          Versioned agent instructions. The active version is used on new runs.
        </p>
      </div>

      {agents.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No prompt versions yet"
          description="Agent prompt versions appear here once a workflow with agents exists."
        />
      ) : (
        Array.from(groups.entries()).map(([workflowId, group]) => (
          <section key={workflowId} className="space-y-3">
            <Link
              href={`/workflows/${workflowId}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
            >
              <GitBranch className="size-3.5" />
              {group.name}
            </Link>
            <div className="space-y-3">
              {group.agents.map((agent) => (
                <Card key={agent.id}>
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold tabular-nums">
                        {agent.order}
                      </span>
                      <span className="font-medium">{agent.name}</span>
                      <Badge variant="secondary">{roleLabel(agent.role)}</Badge>
                    </div>
                    <PromptVersionList versions={agent.promptVersions} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
