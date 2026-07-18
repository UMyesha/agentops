# AgentOps

> AI agent **observability, debugging, and evaluation** platform — a developer tool for running, tracing, evaluating, and monitoring multi-agent AI workflows. Not a chatbot.

AgentOps lets you run a multi-agent **Repository Onboarding** workflow against a repo and inspect the *full trace*: agents → steps → MCP-style tool calls → inputs/outputs → latency → guardrails → eval score → final output.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · shadcn-style UI · PostgreSQL · Prisma · Auth.js (NextAuth v5) · Redis/BullMQ (background jobs, Phase 5) · OpenAI or a deterministic mock provider.

## Status

- **Phase 1 (done):** scaffold, Prisma schema, Docker infra, Auth.js, seed script with two fully-traced demo runs, app shell.
- Phase 2: read-only trace & dashboard UI.
- Phase 3: dynamic multi-agent execution.
- Phase 4: evals & guardrails wired into the runner.
- Phase 5: retries & BullMQ background jobs.

## Getting started

### 1. Prerequisites
- Node.js 20+
- Docker (for Postgres + Redis) — or a hosted Postgres

### 2. Install
```bash
npm install
cp .env.example .env
# generate an auth secret and paste it into AUTH_SECRET:
npx auth secret
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

### 5. Run — web app **and** worker (two terminals)

Since Phase 5, workflow execution runs in a **standalone BullMQ worker**, not in the
HTTP request. The web app enqueues a run and returns immediately; the worker
executes it. Run both:

```bash
# Terminal 1 — web app
npm run dev

# Terminal 2 — execution worker (requires Redis from docker compose)
npm run worker
```

Open http://localhost:3000. The login form is pre-filled with the seeded demo account:

- **Email:** `demo@agentops.dev`
- **Password:** `demo1234`

Clicking **Run workflow** creates a `QUEUED` run and redirects to its Run Detail
page, which polls `QUEUED → RUNNING → COMPLETED | FAILED` as the worker processes
it. (If the worker isn't running, the run stays `QUEUED`.) Explore the data
directly with `npx prisma studio`.

## Queued execution & retries (Phase 5)

- **Why BullMQ:** long multi-agent runs don't belong in an HTTP request. The API
  creates a `QUEUED` `AgentRun`, enqueues one job (`jobId = runId`), and returns
  **202**. A separate worker (`npm run worker`) executes the persisted run.
- **Retry policy:** bounded BullMQ retries (`AGENT_RUN_MAX_ATTEMPTS`, default 3)
  with exponential backoff, applied **only to explicitly classified transient
  failures** (HTTP 408/429/5xx, connection resets/timeouts). Everything else —
  invalid input, preflight/config errors, deterministic tool failures, the
  `simulate failure` scenario, evaluation-schema failures, guardrail findings —
  is **non-retryable** and executes exactly once.
- **Delivery semantics:** BullMQ is **at-least-once**, not exactly-once.
  Protections: `jobId = runId`, a terminal-run no-op, and an atomic
  `QUEUED`/stale-`RUNNING` status transition combined with the BullMQ lock for
  **best-effort** ownership. A missing lock token aborts before any DB write;
  before a trace reset and before a terminal write the worker verifies the lock
  via `job.extendLock(token, lockDuration)` and does nothing on loss. **Strict
  fencing against a lost-lock worker's concurrent writes would require a DB
  owner/fence column, which is out of scope** — so we do **not** claim
  exactly-once execution.
- **Retries keep only the final attempt's detailed trace:** before a retry
  attempt runs, the previous attempt's steps, tool calls, evaluation, and
  guardrails are reset. Full retry history is preserved in `AuditLog`
  (`run.retry_scheduled`, etc.).
- **Enqueue failure** marks the just-created run `FAILED` (never an indefinite
  `QUEUED` orphan) and returns **503**.
- **Test-only retry triggers:** the mock provider's `simulate transient failure
  once` / `... always` phrases are inert unless `AI_PROVIDER=mock` **and**
  `AGENTOPS_ENABLE_RETRY_TEST_TRIGGERS=true` (default false — keep it off in
  production).
- **OpenAI provider transient mapping is not runtime-verified** (no API key in
  this environment).

## Environment variables

See [`.env.example`](.env.example). Key ones: `DATABASE_URL`, `AUTH_SECRET`, optional `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`, `AI_PROVIDER` (`mock` | `openai`), `OPENAI_API_KEY`, `REDIS_URL`.

## Architecture notes

- **Seeded fake run first** — the trace timeline is validated against seed data before the live runner exists.
- **`runTool()` logging wrapper** (Phase 3) — every tool call is persisted uniformly, which *is* the MCP-style observability story.
- **Pluggable `AgentProvider`** — deterministic mock (default) or OpenAI, swapped via `AI_PROVIDER`.
- **Retries as linked runs** — `parentRunId` + `retryCount` preserve full audit history.
