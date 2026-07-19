# Portfolio assets

Fact-grounded summary, resume bullets, demo scripts, and a screenshot checklist
for presenting AgentOps. Everything here is verifiable in the codebase — no
invented users, revenue, latency, or scale.

## One-paragraph summary

**AgentOps** is a full-stack AI-agent observability platform: it runs a
five-agent "Repository Onboarding" workflow through a queued background worker
and persists the complete trace — agents, steps, MCP-style tool calls,
evaluations, and guardrails — for inspection on a LangSmith-style trace timeline.
It demonstrates backend architecture (queue + worker), database design, agent
orchestration with a pluggable provider, evaluation and guardrail systems,
bounded retries with an audit trail, and health/readiness endpoints, built on
Next.js 15, TypeScript, Prisma/Postgres, and Redis/BullMQ.

## Resume bullets

- Built a full-stack AI-agent observability platform (Next.js 15, TypeScript,
  Prisma/Postgres, Redis/BullMQ) that executes a five-agent workflow and persists
  a full inspectable trace of steps, tool calls, evaluations, and guardrails.
- Designed a queued execution model: the web app enqueues runs to a standalone
  BullMQ worker with bounded, backoff-based retries and an append-only audit
  trail, using `jobId = runId`, atomic status claims, and a lock fence to reduce
  duplicate execution under at-least-once delivery.
- Implemented a pluggable `AgentProvider` (deterministic mock default + OpenAI)
  and a single `runTool()` wrapper that uniformly persists every tool call —
  inputs, outputs, status, and latency — as the MCP-style observability layer.
- Added rubric-based evaluation (0–100, pass/fail, per-criterion feedback) and a
  non-fatal guardrail system, with owner-scoped authorization on every query.
- Hardened for deployment: server-only config boundary, startup environment
  validation, `/api/health` + `/api/ready` probes, a multi-stage Docker image
  running web and worker from one build, and a mocked GitHub Actions CI.
- Wrote **178 automated tests** (Vitest, fully mocked — no database or Redis
  required) covering the runner, retries, evaluation, guardrails, queue, routes,
  environment validation, run-status copy, and authorization regressions.

> Update the test count if the suite changes: `npm test` reports the current total.

## Suggested GitHub repo description & topics

**Description:** _AI-agent observability & evaluation platform — queued multi-agent
execution with full trace timelines, evals, guardrails, and bounded retries.
Next.js 15 · TypeScript · Prisma/Postgres · Redis/BullMQ._

**Topics:** `ai-agents` · `observability` · `llm` · `nextjs` · `typescript` ·
`prisma` · `postgresql` · `redis` · `bullmq` · `evaluation` · `guardrails` ·
`developer-tools`

## 2-minute demo script

Use [`docs/demo-script.md`](demo-script.md): landing → demo login → dashboard
metrics → completed run trace (expand Code Search, view Evaluation/Guardrails) →
trigger a live queued run → failure/retry states → health/ready.

## 5-minute technical walkthrough

1. **Architecture (1m)** — web vs. worker split; Postgres as source of truth;
   Redis/BullMQ between them. Show the Mermaid diagrams in
   [`docs/architecture.md`](architecture.md).
2. **Data model (1m)** — `prisma/schema.prisma`: `AgentRun → RunStep → ToolCall`,
   `EvaluationResult`, `GuardrailViolation`, `AuditLog`; retry lineage via
   `retryCount`/`parentRunId`.
3. **Execution path (1.5m)** — `POST /api/workflows/:id/runs` creates a `QUEUED`
   run and enqueues; the worker (`src/workers/agentRunWorker.ts` →
   `src/agents/runner.ts`) claims it atomically, runs the pipeline, and writes the
   trace. Walk the retry classification and the lock fence.
4. **Observability (1m)** — the `runTool()` wrapper; the trace timeline; run-status
   copy derived only from persisted signals (`src/lib/runStatusCopy.ts`).
5. **Quality & hardening (0.5m)** — mocked test suite, env validation,
   health/ready, Docker + CI.

## Screenshot checklist

Capture at a desktop width (light theme) and a narrow/mobile width. Save under
`docs/images/` and reference them in the README table.

- [ ] `landing.png` — landing page hero + capabilities.
- [ ] `login.png` — login with demo mode on (credentials hint visible).
- [ ] `dashboard.png` — metric cards + recent runs/errors.
- [ ] `run-trace.png` — a completed run's trace timeline with a step expanded to
      show tool-call JSON.
- [ ] `evaluation.png` — Evaluation tab (score + rubric) and/or Guardrails tab.
- [ ] `run-failed.png` — a failed run: failure banner, skipped steps, execution
      history strip.
- [ ] `mobile-nav.png` — the mobile navigation drawer open on a narrow viewport.

## Honest limitations (framing)

Present these as deliberate scope decisions: mock provider default (OpenAI
unverified without a key), a single seeded demo workspace, at-least-once delivery
with duplicate-reducing safeguards (no exactly-once claim), and no
cancellation/scheduling/batch/admin-dashboard. They show engineering judgment
about scope, not gaps to hide.
