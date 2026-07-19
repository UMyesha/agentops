# Demo script (2 minutes)

A guided end-to-end walkthrough. Prerequisites:

```bash
docker compose up -d          # Postgres + Redis
npm run dev                   # Terminal 1 — web
npm run worker                # Terminal 2 — worker
# .env: AGENTOPS_DEMO_MODE=true  (to pre-fill demo credentials)
```

Open http://localhost:3000.

## 1. Landing → login (15s)
- The landing page explains the product: capabilities, execution lifecycle,
  architecture, the five-agent example workflow, and honest limitations.
- Click **Sign in** or **Explore the demo** → both go to `/login`.
- With demo mode on, credentials are pre-filled (`demo@agentops.dev` /
  `demo1234`). Click **Sign in**.

## 2. Dashboard (15s)
- Metrics: total runs, success rate, failed, active (queued/running), avg
  latency (completed only), avg eval score, retried runs, guardrail hits.
- Hover the info icons on the ambiguous metrics for their exact definitions.
- Recent runs and recent errors are listed below.

## 3. Inspect the completed run (30s)
- Go to **Projects → Repository Onboarding → the completed run**.
- The **trace timeline** shows five ordered agent steps. Expand **Code Search**
  to see its MCP-style tool calls, each with input/output JSON, status, and latency.
- Open the **Evaluation** tab (score + per-criterion rubric + feedback) and the
  **Guardrails** tab.

## 4. Run a new workflow (30s)
- On the workflow page, click **Run workflow**. The confirm panel lists the five
  agents and the configured provider, and notes the run is queued.
- Submit → you're taken to the new run's page. It shows **Queued → Running →
  Completed** live (the status strip is announced via `aria-live`), then renders
  the full fresh trace.

## 5. Failure & retry states (20s)
- Open the seeded **failed** run: the failure banner explains the outcome using
  only persisted signals; skipped steps render muted; guardrails list the
  violations. The **Execution history** strip shows the audit trail.
- Stop the worker and start a run to see the **"Waiting for worker"** copy; a
  failed enqueue shows the **"Couldn't queue this run"** banner instead.

## 6. Health & readiness (10s)
```bash
curl -s localhost:3000/api/health   # {"status":"ok"}
curl -s localhost:3000/api/ready    # {"db":"ok","redis":"ok"}  (503 if a dep is down)
```

## Reset
```bash
npm run db:seed     # restores the deterministic demo data
```
