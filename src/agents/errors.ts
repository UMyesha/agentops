import { ToolError } from "@/tools/errors";

/**
 * Error classification for bounded retries.
 *
 * Only *explicitly* transient failures are retried. Classification uses
 * structured signals (error type, HTTP status code, Node error code) — never
 * fragile string matching — and the default for anything unrecognized is
 * NON-retryable, so we never retry an arbitrary thrown Error.
 */

/** A genuinely transient failure (network/provider) that is safe to retry. */
export class RetryableRunError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "RetryableRunError";
    this.cause = cause;
  }
}

/** A deterministic failure that must NOT be retried. */
export class NonRetryableRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableRunError";
  }
}

// Transient HTTP statuses (timeouts, rate limit, upstream 5xx).
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

// Transient Node/network error codes.
const RETRYABLE_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
]);

function numericStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as Record<string, unknown>;
  for (const key of ["status", "statusCode"]) {
    const v = e[key];
    if (typeof v === "number") return v;
  }
  // OpenAI SDK nests the HTTP status under `.response.status`.
  const resp = e["response"];
  if (typeof resp === "object" && resp !== null) {
    const s = (resp as Record<string, unknown>)["status"];
    if (typeof s === "number") return s;
  }
  return undefined;
}

function errorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const c = (err as Record<string, unknown>)["code"];
  return typeof c === "string" ? c : undefined;
}

/**
 * Classify a thrown value. Priority: explicit marker classes → structured
 * status/code → default NON-retryable.
 */
export function classifyError(err: unknown): "retryable" | "non_retryable" {
  if (err instanceof RetryableRunError) return "retryable";
  if (err instanceof NonRetryableRunError) return "non_retryable";
  // Deterministic tool failures (e.g. file not found) are business failures.
  if (err instanceof ToolError) return "non_retryable";

  const status = numericStatus(err);
  if (status !== undefined && RETRYABLE_STATUS.has(status)) return "retryable";

  const code = errorCode(err);
  if (code !== undefined && RETRYABLE_CODES.has(code)) return "retryable";

  // Unknown/unclassified → do not retry.
  return "non_retryable";
}

export function isRetryable(err: unknown): boolean {
  return classifyError(err) === "retryable";
}
