# Security review checklist

A record of what was verified during the Phase 6 hardening pass. This is an
engineering self-review of a portfolio project, **not** a penetration test or a
certification claim.

## Authentication & authorization
- [x] Every `(app)` route is gated by the shared layout `auth()` — an
      unauthenticated visitor is redirected to `/login` before any page renders.
- [x] Every run/project query is owner-scoped via `ownedRunWhere(userId)` /
      `project.ownerId`; there is no unscoped data access path.
- [x] `getRunAuditTrail` applies an ownership fence before reading any audit rows
      (returns `[]` for a non-owned run; never reads another user's logs).
- [x] GET API routes return `401` when unauthenticated and `404` when the
      resource is missing **or not owned** (indistinguishable to the caller).
- [x] Regression test asserts a non-owned run detail/audit query yields
      null/`[]` and the owner filter is present (`src/lib/queries/ownership.test.ts`).

## Input handling
- [x] POST routes validate the request body with Zod (`400` on invalid input).
- [x] The run-trigger route runs preflight before enqueue (`404`/`422` for
      missing/misconfigured workflows).

## Secret hygiene
- [x] No `NEXT_PUBLIC_*` variables; no secrets serialized to the client.
- [x] `appConfig.ts` / `env.ts` / `readiness.ts` / `db` / `queue` / `runner` /
      providers are never imported by a client component (verified by grep).
- [x] `appConfig.ts` is `import "server-only"` — a client import is a build error.
- [x] Only a serializable `demoMode: boolean` prop crosses to `LoginForm`; the
      form never imports server config.
- [x] Audit `metadata` carries only internal messages and structured flags
      (`reason`, `retryAttempt`, `retryable`, `score`) — no secrets or credentials.
- [x] Environment validation messages log variable **names**, never values.
- [x] `.gitignore` excludes `.env*`, `dev.log`, and `worker*.log`.

## Error surfaces
- [x] API errors return generic bodies (`Unauthorized` / `Not found` /
      `Internal error`); the underlying exception message is logged server-side
      but never returned (`src/lib/api.test.ts`).
- [x] The `(app)` error boundary shows safe copy and only an opaque `digest`
      reference — no stack traces.
- [x] `/api/health` exposes no dependencies or secrets.
- [x] `/api/ready` reports only generic `"ok" | "error"` per dependency — no
      messages, stack traces, or connection strings (`src/app/api/ready-route.test.ts`).

## Output rendering
- [x] All persisted JSON is rendered through React (escaped) and the `JsonViewer`
      (text nodes) — no `dangerouslySetInnerHTML`.

## Execution safety
- [x] The queue payload is `{ runId, userId }` only — no request data or secrets.
- [x] Guardrail and audit write failures are non-fatal by design.
- [x] Synthetic retry triggers are inert unless `AI_PROVIDER=mock` **and**
      `AGENTOPS_ENABLE_RETRY_TEST_TRIGGERS=true` (default false), and are never
      surfaced in the UI.

## Out of scope (documented, not implemented)
- Strict exactly-once execution fencing (see `docs/architecture.md`).
- Rate limiting, CSRF beyond Auth.js defaults, multi-tenant isolation, RBAC.
