import "server-only";

/**
 * Server-only application configuration gates.
 *
 * `import "server-only"` makes any client-component import a build-time error:
 * these decisions are made on the server and only their serializable *result*
 * (e.g. a `demoMode: boolean` prop) may ever cross into client code. There is
 * deliberately NO public config object and NO `NEXT_PUBLIC_*` mirror.
 */

/**
 * Whether demo mode is enabled. When true, the login page reveals and prefills
 * the seeded demo credentials; when false, the login form is blank with no hint.
 *
 * Default false — the single decision point, mirroring `retryTriggersEnabled()`
 * in src/queue/config.ts.
 */
export function demoModeEnabled(): boolean {
  return (process.env.AGENTOPS_DEMO_MODE ?? "false").toLowerCase() === "true";
}

/**
 * The configured agent provider name (defaults to "mock"). Server-only so it is
 * safe to read process.env; server components pass the resulting string as a
 * plain prop for display. Does not construct a provider or read any secret.
 */
export function configuredProviderName(): string {
  return (process.env.AI_PROVIDER ?? "mock").toLowerCase();
}
