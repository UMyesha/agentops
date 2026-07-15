import Link from "next/link";
import {
  Workflow,
  Activity,
  ShieldAlert,
  ListChecks,
  GitBranch,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Activity,
    title: "Full trace timelines",
    body: "Inspect every agent, step, and tool call with inputs, outputs, latency, and errors.",
  },
  {
    icon: Wrench,
    title: "MCP-style tool calls",
    body: "Structured, schema-typed tools — every call logged and replayable.",
  },
  {
    icon: ListChecks,
    title: "Evals & scoring",
    body: "Rubric-based evaluation of final outputs with pass/fail and per-criterion feedback.",
  },
  {
    icon: ShieldAlert,
    title: "Guardrails",
    body: "Catch empty output, missing sections, tool failures, and unsupported claims.",
  },
  {
    icon: GitBranch,
    title: "Prompt versioning",
    body: "Track prompt/instruction versions per agent and snapshot them onto each run.",
  },
  {
    icon: Workflow,
    title: "Multi-agent workflows",
    body: "Planner, Code Search, Documentation, Validator, and Evaluator agents working together.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Workflow className="size-5 text-primary" />
          <span className="font-semibold tracking-tight">AgentOps</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="mb-4 inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
          Observability for AI agents
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Run, trace, and evaluate multi-agent AI workflows.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          AgentOps is a developer platform for debugging agent runs — trace
          timelines, MCP-style tool calls, evals, guardrails, and retries.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/login">Open the dashboard</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">View a demo run</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border bg-card p-5">
              <Icon className="mb-3 size-5 text-primary" />
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
