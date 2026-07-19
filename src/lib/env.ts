/**
 * Centralized environment validation.
 *
 * Two call sites with different strictness:
 *  - `validateWorkerEnv()` runs at WORKER startup and **exits non-zero** on any
 *    missing/invalid required config — a misconfigured worker must fail loudly
 *    rather than silently drop jobs.
 *  - `checkWebEnv()` is **lazy / non-fatal**: it returns warnings and never
 *    throws, so it can be called during server startup without breaking
 *    `next build` (which runs with placeholder envs and must not connect).
 *
 * Dependency-light and pure at its core (`collectEnvErrors`) so it is trivially
 * unit-testable with an injected env object. Secrets are never logged — only
 * variable NAMES appear in messages, never their values.
 */

export type EnvContext = "web" | "worker";

type Env = Record<string, string | undefined>;

function isBlank(v: string | undefined): boolean {
  return v == null || v.trim() === "";
}

/** A positive-integer numeric var: only an error when SET to an invalid value. */
function badPositiveInt(env: Env, name: string, min = 1): string | null {
  const raw = env[name];
  if (isBlank(raw)) return null; // unset → a safe default is used elsewhere
  const n = Number.parseInt(raw as string, 10);
  if (!Number.isFinite(n) || n < min) {
    return `${name} must be an integer >= ${min} when set`;
  }
  return null;
}

/**
 * Pure validator: returns a (possibly empty) list of human-readable problems.
 * Never reads `process.env` directly and never logs — callers decide severity.
 */
export function collectEnvErrors(env: Env, context: EnvContext): string[] {
  const errors: string[] = [];

  // Always required.
  if (isBlank(env.DATABASE_URL)) errors.push("DATABASE_URL is required");

  // AUTH_SECRET secures web sessions. The worker doesn't serve auth, so it is
  // only required for the web context.
  if (context === "web" && isBlank(env.AUTH_SECRET)) {
    errors.push("AUTH_SECRET is required");
  }

  // The worker is the only process that connects to Redis + runs the provider.
  if (context === "worker" && isBlank(env.REDIS_URL)) {
    errors.push("REDIS_URL is required for the worker");
  }

  // Provider config: OpenAI needs a key. Mock (default) needs nothing.
  const provider = (env.AI_PROVIDER ?? "mock").toLowerCase();
  if (provider === "openai" && isBlank(env.OPENAI_API_KEY)) {
    errors.push('OPENAI_API_KEY is required when AI_PROVIDER="openai"');
  } else if (provider !== "mock" && provider !== "openai") {
    errors.push('AI_PROVIDER must be "mock" or "openai"');
  }

  // GitHub OAuth is optional, but half-configured is a misconfiguration.
  const hasGithubId = !isBlank(env.AUTH_GITHUB_ID);
  const hasGithubSecret = !isBlank(env.AUTH_GITHUB_SECRET);
  if (hasGithubId !== hasGithubSecret) {
    errors.push(
      "AUTH_GITHUB_ID and AUTH_GITHUB_SECRET must both be set, or both be empty"
    );
  }

  // Queue/worker numerics: optional (defaulted), but reject invalid explicit values.
  for (const name of [
    "AGENT_RUN_MAX_ATTEMPTS",
    "AGENT_WORKER_CONCURRENCY",
    "AGENT_WORKER_LOCK_DURATION_MS",
  ]) {
    const problem = badPositiveInt(env, name, 1);
    if (problem) errors.push(problem);
  }
  const backoff = badPositiveInt(env, "AGENT_RUN_BACKOFF_MS", 0);
  if (backoff) errors.push(backoff);

  return errors;
}

/**
 * Worker-startup validation. On any error, logs each problem (names only) and
 * exits non-zero. Injectable env/exit for testing.
 */
export function validateWorkerEnv(
  env: Env = process.env,
  exit: (code: number) => never = process.exit as (code: number) => never
): void {
  const errors = collectEnvErrors(env, "worker");
  if (errors.length > 0) {
    console.error("[worker] invalid environment configuration:");
    for (const e of errors) console.error(`  - ${e}`);
    exit(1);
  }
}

/**
 * Web-side validation: non-fatal. Returns warnings and logs them; never throws
 * or exits, so it is safe to call during server bootstrap and at build time.
 */
export function checkWebEnv(env: Env = process.env): string[] {
  const warnings = collectEnvErrors(env, "web");
  if (warnings.length > 0) {
    console.warn("[env] environment warnings (non-fatal):");
    for (const w of warnings) console.warn(`  - ${w}`);
  }
  return warnings;
}
