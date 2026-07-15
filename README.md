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

### 5. Run
```bash
npm run dev
```
Open http://localhost:3000. The login form is pre-filled with the seeded demo account:

- **Email:** `demo@agentops.dev`
- **Password:** `demo1234`

Explore the seeded data directly with `npx prisma studio`.

## Environment variables

See [`.env.example`](.env.example). Key ones: `DATABASE_URL`, `AUTH_SECRET`, optional `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`, `AI_PROVIDER` (`mock` | `openai`), `OPENAI_API_KEY`, `REDIS_URL`.

## Architecture notes

- **Seeded fake run first** — the trace timeline is validated against seed data before the live runner exists.
- **`runTool()` logging wrapper** (Phase 3) — every tool call is persisted uniformly, which *is* the MCP-style observability story.
- **Pluggable `AgentProvider`** — deterministic mock (default) or OpenAI, swapped via `AI_PROVIDER`.
- **Retries as linked runs** — `parentRunId` + `retryCount` preserve full audit history.
