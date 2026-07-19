# Deployment

AgentOps ships as **one Docker image** that runs either of two processes,
selected by the container command:

| Process | Command | Needs |
| --- | --- | --- |
| Web | `npm start` (`next start`) | Postgres, `AUTH_SECRET` |
| Worker | `npm run worker` (`tsx …`) | Postgres, Redis |

`tsx` is a **runtime dependency**, so the worker runs from TypeScript source with
no separate build step. See [`Dockerfile`](../Dockerfile) and
[`docker-compose.prod.yml`](../docker-compose.prod.yml).

## Build & run

```bash
# Build the single image
docker build -t agentops:latest .

# Bring up postgres, redis, web, and worker
docker compose -f docker-compose.prod.yml up -d

# Run migrations once (release step — NOT baked into the image)
docker compose -f docker-compose.prod.yml run --rm web npx prisma migrate deploy

# (optional) seed demo data
docker compose -f docker-compose.prod.yml run --rm web npm run db:seed
```

## Environment matrix

| Variable | Web | Worker | Notes |
| --- | :-: | :-: | --- |
| `DATABASE_URL` | ✅ | ✅ | Postgres connection string |
| `AUTH_SECRET` | ✅ | – | Auth.js session secret |
| `AUTH_URL` | ✅ | – | Public base URL for callbacks |
| `REDIS_URL` | ✅ | ✅ | Web enqueues; worker consumes |
| `AI_PROVIDER` | ✅ | ✅ | `mock` (default) or `openai` |
| `OPENAI_API_KEY` | – | ✅¹ | Required when `AI_PROVIDER=openai` |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | optional | – | Both or neither |
| `AGENTOPS_DEMO_MODE` | optional | – | `true` reveals demo credentials on login |
| `AGENT_RUN_MAX_ATTEMPTS` / `AGENT_RUN_BACKOFF_MS` / `AGENT_WORKER_CONCURRENCY` / `AGENT_WORKER_LOCK_DURATION_MS` | – | optional | Queue/worker tuning (sane defaults) |

¹ The worker is the process that runs the provider, so the OpenAI key belongs to
the worker. Keep `AGENTOPS_DEMO_MODE` and `AGENTOPS_ENABLE_RETRY_TEST_TRIGGERS`
**false** outside of demos.

The worker calls `validateWorkerEnv()` at startup and **exits non-zero** on
missing/invalid required config, so a misconfigured worker fails loudly instead
of silently dropping jobs.

## Startup ordering & readiness

1. Start **Postgres** and **Redis**; wait for their health checks.
2. Run `prisma migrate deploy`.
3. Start **web** and **worker**.
4. Gate traffic on `GET /api/ready` returning `200` (both `db` and `redis` `ok`).
   `GET /api/health` reports only that the web process is up.

The worker shuts down gracefully on `SIGINT`/`SIGTERM` (closes the BullMQ worker
and its Redis connection before exit).

## Worker-host caveat

The worker is a **long-lived process**. Platforms that can only run short-lived,
request-scoped functions (serverless-only hosts) **cannot host the worker** and
are therefore unsuitable for execution, even if they can serve the web app.
Deploy the worker on a platform that supports persistent processes
(a container runtime, a VM, or a managed background-worker service).

## Secrets

No secrets are committed or baked into images. The image build uses
build-only placeholder `DATABASE_URL`/`AUTH_SECRET` values so `next build` never
connects to a real database. Provide real secrets at runtime via the environment
or an uncommitted `.env` file.
