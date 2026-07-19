import Link from "next/link";
import {
  Workflow,
  Activity,
  ShieldAlert,
  ListChecks,
  GitBranch,
  Wrench,
  ArrowRight,
  Database,
  Server,
  Cpu,
  Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// The marketing landing page is fully STATIC and identical for every visitor —
// it is NOT conditioned on AGENTOPS_DEMO_MODE. CTAs are neutral and point at
// /login, which decides (at request time) whether to surface demo credentials.

const CAPABILITIES = [
  {
    icon: Activity,
    title: "Full trace timelines",
    body: "Inspect every agent, step, and tool call with inputs, outputs, latency, and errors.",
  },
  {
    icon: Wrench,
    title: "MCP-style tool calls",
    body: "Structured, schema-typed tools — every call persisted with its input, output, and status.",
  },
  {
    icon: ListChecks,
    title: "Evals & scoring",
    body: "Rubric-based evaluation of final outputs with pass/fail and per-criterion feedback.",
  },
  {
    icon: ShieldAlert,
    title: "Guardrails",
    body: "Catch empty output, missing sections, tool failures, and unsupported claims — non-fatally.",
  },
  {
    icon: GitBranch,
    title: "Prompt versioning",
    body: "Track prompt/instruction versions per agent and snapshot them onto each run.",
  },
  {
    icon: Workflow,
    title: "Queued multi-agent runs",
    body: "A BullMQ worker executes runs asynchronously with bounded, audited retries.",
  },
];

const LIFECYCLE = [
  { label: "QUEUED", desc: "Enqueued for the worker" },
  { label: "RUNNING", desc: "Agents execute in order" },
  { label: "COMPLETED", desc: "Evaluated and scored" },
  { label: "FAILED", desc: "Reason recorded; retried if transient" },
];

const AGENTS = [
  { role: "Planner", desc: "Breaks the request into a documentation plan." },
  { role: "Code Search", desc: "Reads the repository through MCP-style tools." },
  { role: "Documentation", desc: "Drafts the onboarding document." },
  { role: "Validator", desc: "Checks structure and completeness." },
  { role: "Evaluator", desc: "Scores the result against a rubric." },
];

const ARCHITECTURE = [
  { icon: Server, label: "Next.js web", desc: "UI + API; enqueues runs" },
  { icon: Cpu, label: "Worker", desc: "Executes the agent pipeline" },
  { icon: Database, label: "Postgres", desc: "Runs, traces, evals, audit" },
  { icon: Boxes, label: "Redis + BullMQ", desc: "Job queue & retries" },
];

const LIMITATIONS = [
  "The default agent provider is a deterministic mock — no API key required. An OpenAI provider is available but has not been runtime-verified here.",
  "Ships with a single seeded demo workspace to illustrate the product; it is not a multi-tenant or hosted service.",
  "BullMQ provides at-least-once delivery, with database claims and idempotency safeguards that reduce duplicate execution.",
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

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="mb-4 inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
          Observability for AI agents
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Run, trace, and evaluate multi-agent AI workflows.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          AgentOps is a developer platform for debugging agent runs — trace
          timelines, MCP-style tool calls, evals, guardrails, and bounded
          retries, all persisted and inspectable.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/login">
              Sign in
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Explore the demo</Link>
          </Button>
        </div>
      </section>

      {/* Product overview */}
      <section className="mx-auto max-w-3xl px-6 pb-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Built for developers debugging multi-agent workflows
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          When a pipeline of agents calls tools, evaluates output, and retries on
          failure, the hard part is seeing what actually happened. AgentOps
          records each run end to end — every step, tool call, evaluation, and
          guardrail — so you can trace a result back to its cause.
        </p>
      </section>

      {/* Capabilities */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Core capabilities
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border bg-card p-5">
              <Icon className="mb-3 size-5 text-primary" />
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Execution lifecycle */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Execution lifecycle
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LIFECYCLE.map((s, i) => (
            <li key={s.label} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full border bg-background text-xs font-semibold tabular-nums">
                  {i + 1}
                </span>
                <span className="font-mono text-sm font-semibold">{s.label}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Transient failures are retried with bounded attempts; each attempt is
          recorded in the audit trail.
        </p>
      </section>

      {/* Architecture summary */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="mb-6 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Architecture
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ARCHITECTURE.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-lg border bg-card p-4 text-center">
              <Icon className="mx-auto mb-2 size-5 text-primary" />
              <div className="font-medium">{label}</div>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          The web app enqueues work; a separate worker process executes it. Both
          share Postgres; the queue runs on Redis.
        </p>
      </section>

      {/* Example workflow */}
      <section className="mx-auto max-w-3xl px-6 pb-20">
        <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Example workflow — Repository Onboarding
        </h2>
        <p className="mx-auto mb-6 max-w-xl text-center text-sm text-muted-foreground">
          Five agents cooperate to produce onboarding documentation for a repository.
        </p>
        <ol className="space-y-2">
          {AGENTS.map((a, i) => (
            <li
              key={a.role}
              className="flex items-center gap-3 rounded-lg border bg-card p-3"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold tabular-nums">
                {i + 1}
              </span>
              <span className="font-medium">{a.role}</span>
              <span className="text-sm text-muted-foreground">{a.desc}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <div className="rounded-2xl border bg-card p-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            See a fully-traced run
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Sign in to open the dashboard and inspect a completed run, its
            evaluation, and its guardrails.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                Sign in
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Explore the demo</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Honest limitations */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Honest limitations
        </h2>
        <ul className="space-y-2">
          {LIMITATIONS.map((l) => (
            <li
              key={l}
              className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground"
            >
              {l}
            </li>
          ))}
        </ul>
      </section>

      <footer className="border-t">
        <div className="mx-auto max-w-5xl px-6 py-6 text-center text-xs text-muted-foreground">
          AgentOps — a portfolio project demonstrating agent observability,
          evaluation, and queued execution.
        </div>
      </footer>
    </div>
  );
}
