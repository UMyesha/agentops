# AgentOps

> AI agent **observability, debugging, and evaluation** platform — a developer tool for running, tracing, evaluating, and monitoring multi-agent AI workflows. Not a chatbot.

AgentOps runs a multi-agent **Repository Onboarding** workflow and lets you inspect the *full trace*: agents → steps → MCP-style tool calls → inputs/outputs → latency → guardrails → evaluation score → final output. Execution is queued to a background worker with bounded, audited retries.

> **Project status:** portfolio project. The default agent provider is a deterministic mock (no API key required); an OpenAI provider exists but has not been runtime-verified here. There are no claims of production usage, scale, or real users.

## 🚀 Live demo

**Try it now:** **[web-production-9827f.up.railway.app](https://web-production-9827f.up.railway.app)**

Sign in with the seeded demo account:

| Email | Password |
| --- | --- |
| `demo@agentops.dev` | `demo1234` |

These are throwaway credentials for a public demo workspace — not real secrets. The deployment runs the **deterministic mock provider** (`AI_PROVIDER=mock`), so runs are reproducible and require no API key; nothing calls a paid LLM.

## Screenshots

<!-- Screenshot placeholders — see docs/portfolio.md for the capture checklist. -->
| Dashboard | Run trace timeline | Evaluation & guardrails |
| --- | --- | --- |
| _add `docs/images/dashboard.png`_ | _add `docs/images/run-trace.png`_ | _add `docs/images/evaluation.png`_ |

## Features

- **Trace timelines** — every run persisted as agents → steps → tool calls with inputs/outputs, latency, timestamps, and errors.
- **MCP-style tool calls** — schema-typed tools; every call logged uniformly through one `runTool()` wrapper.
- **Evaluations** — a rubric scores each completed run (0–100, pass/fail, per-criterion feedback).
- **Guardrails** — non-fatal checks for empty output, missing sections, tool failures, unsupported claims, and more.
- **Queued execution** — the web app enqueues; a standalone BullMQ worker executes; the run page polls to completion.
- **Bounded retries** — transient failures retry with backoff; every attempt is recorded in the audit log.
- **Prompt versioning** — versioned agent instructions, snapshotted onto each run.
- **Health & readiness** — `/api/health` (liveness) and `/api/ready` (Postgres + Redis probes).

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Radix UI primitives · PostgreSQL · Prisma · Auth.js (NextAuth v5) · Redis + BullMQ · OpenAI or a deterministic mock provider · Vitest.

## Architecture

```mermaid
flowchart LR
  user([User]) -->|HTTP| web[Next.js web app]
  web -->|enqueue runId| redis[(Redis + BullMQ)]
  web -->|read/write| pg[(Postgres)]
  redis -->|job| worker[Worker process]
  worker -->|execute pipeline\nwrite trace| pg
  worker -->|agent calls| provider{{AgentProvider\nmock | openai}}
```

The web app never executes runs — it enqueues them and returns immediately. A separate long-lived **worker** process executes the five-agent pipeline and writes the trace. Both share Postgres; the queue runs on Redis. See [`docs/architecture.md`](docs/architecture.md) for sequence and retry-lifecycle diagrams and the delivery-semantics discussion.

## Getting started

### 1. Prerequisites
- **Node.js 20 (LTS)** — the supported local runtime, matching the Docker image
  (`node:20-alpine`) and CI. An [`.nvmrc`](.nvmrc) pins it: run `nvm use` (or your
  version manager's equivalent). `package.json` `engines` also declares `>=20 <21`.
  Newer major Node versions are not supported for local development — the `next dev`
  Tailwind/PostCSS config loader has been observed to fail under Node 24.
- Docker (for Postgres + Redis), or a hosted Postgres + Redis

### 2. Install
```bash
npm install
cp .env.example .env
npx auth secret   # writes AUTH_SECRET into .env
```

### 3. Start infrastructure
```bash
docker compose up -d
```

### 4. Database
```bash
npx prisma migrate dev --name init
npx prisma db seed
```

### 5. Run the web app **and** the worker (two terminals)
```bash
# Terminal 1 — web app
npm run dev

# Terminal 2 — execution worker (requires Redis)
npm run worker
```

Open http://localhost:3000.

### Demo login

Set `AGENTOPS_DEMO_MODE=true` in `.env` to have the login page **reveal and pre-fill** the seeded demo credentials:

- **Email:** `demo@agentops.dev`
- **Password:** `demo1234`

With demo mode **off** (the default), the login form is blank with no credential hint — sign in with the seeded credentials manually or via GitHub OAuth. The marketing landing page is static and identical regardless of demo mode.

Clicking **Run workflow** creates a `QUEUED` run and redirects to its Run Detail page, which polls `QUEUED → RUNNING → COMPLETED | FAILED` as the worker processes it. Explore the raw data with `npx prisma studio`.

## Execution lifecycle & retries

- **Why a queue:** long multi-agent runs don't belong in an HTTP request. The API creates a `QUEUED` `AgentRun`, enqueues one job (`jobId = runId`), and returns **202**. The worker executes the persisted run.
- **Retry policy:** bounded BullMQ retries (`AGENT_RUN_MAX_ATTEMPTS`, default 3) with exponential backoff, applied **only to explicitly classified transient failures** (HTTP 408/429/5xx, connection resets/timeouts). Everything else — invalid input, preflight/config errors, deterministic tool failures, evaluation-schema failures, guardrail findings — is non-retryable and runs once.
- **Delivery semantics:** BullMQ provides **at-least-once** delivery, with database claims and idempotency safeguards (`jobId = runId`, a terminal-run no-op, atomic `QUEUED`/stale-`RUNNING` transitions, and a best-effort BullMQ lock fence) that reduce duplicate execution. The reasons a strict single-delivery guarantee is *not* claimed are documented in [`docs/architecture.md`](docs/architecture.md).
- **Retry history:** before a retry runs, the previous attempt's steps/tool-calls/eval/guardrails are reset; full history is preserved in `AuditLog` and shown as the run's **Execution history** strip.
- **Enqueue failure** marks the just-created run `FAILED` (never an indefinite `QUEUED` orphan) and returns **503**.
- **Test-only retry triggers:** the mock provider's `simulate transient failure once` / `... always` phrases are inert unless `AI_PROVIDER=mock` **and** `AGENTOPS_ENABLE_RETRY_TEST_TRIGGERS=true` (default false — keep it off in production). They are never surfaced in the UI.

## Health & readiness

- `GET /api/health` → `200 {"status":"ok"}` if the web process is serving. No dependencies, no secrets.
- `GET /api/ready` → probes Postgres (`SELECT 1`) and Redis (a dedicated short-lived `PING`); `200 {"db":"ok","redis":"ok"}` when both pass, otherwise `503` with generic per-dependency `"ok" | "error"` — never messages, stack traces, or connection strings.

## Environment variables

See [`.env.example`](.env.example). Key ones:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | always | Postgres connection string |
| `AUTH_SECRET` | web | Auth.js session secret (`npx auth secret`) |
| `REDIS_URL` | worker | Redis/BullMQ connection |
| `AI_PROVIDER` | – | `mock` (default) or `openai` |
| `OPENAI_API_KEY` | if `openai` | OpenAI API key |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | optional | GitHub OAuth (both or neither) |
| `AGENTOPS_DEMO_MODE` | – | `true` reveals demo credentials on login (default false) |
| `AGENTOPS_ENABLE_RETRY_TEST_TRIGGERS` | – | test-only synthetic transient failures (default false) |

The worker validates required configuration at startup and exits non-zero on invalid config. Secrets are never exposed via `NEXT_PUBLIC_*`, client code, logs, health/readiness routes, Docker images, or CI.

## Deployment

One image, two processes (web via `npm start`, worker via `npm run worker`). See [`docs/deployment.md`](docs/deployment.md) and [`docker-compose.prod.yml`](docker-compose.prod.yml). Migrations run as a release step: `npx prisma migrate deploy`. A serverless-only host cannot run the long-lived worker; the [live demo](#-live-demo) is deployed on a container platform that runs both processes.

## Commands

```bash
npm run dev        # web app (dev)
npm run worker     # execution worker
npm test           # Vitest suite (mocked; no DB/Redis needed)
npx tsc --noEmit   # typecheck
npm run lint       # lint
npm run build      # production build
npm run db:seed    # seed the demo data
npm run db:studio  # browse the database
```

## Known limitations

- The default provider is a deterministic mock; the OpenAI provider is unverified here (no API key).
- Ships a single seeded demo workspace; single-tenant, not a multi-tenant SaaS (the [live demo](#-live-demo) is one shared workspace).
- At-least-once delivery (see delivery semantics above); no exactly-once guarantee is claimed.
- No cancellation, scheduling/recurring runs, batch execution, or admin queue dashboard.
- Retries keep only the final attempt's detailed trace (full history remains in the audit log).

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — system, data-flow, execution sequence, retry lifecycle, delivery semantics.
- [`docs/deployment.md`](docs/deployment.md) — env matrix, start commands, startup ordering, worker-host caveat.
- [`docs/demo-script.md`](docs/demo-script.md) — a 2-minute guided walkthrough.
- [`docs/security-review.md`](docs/security-review.md) — the security checklist verified for this project.
- [`docs/portfolio.md`](docs/portfolio.md) — summary, resume bullets, demo scripts, screenshot checklist.
