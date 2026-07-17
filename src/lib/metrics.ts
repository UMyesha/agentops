// Token and cost estimation for agent runs.
//
// Cost integrity note: the mock provider makes ZERO API calls and therefore
// costs exactly nothing. We deliberately report $0 for it rather than a
// realistic-looking number — this is an observability tool, and inventing
// financial data would undermine the thing it exists to report truthfully.
// Token counts remain estimated for mock runs because they measure real work
// performed (text produced), which is a different claim from money spent.

/** USD per 1K tokens, blended input/output. Only real (billed) models appear here. */
const PRICE_PER_1K: Record<string, number> = {
  "gpt-4o-mini": 0.00026,
  "gpt-4o": 0.00438,
  "gpt-4.1-mini": 0.00026,
};

/** Rough token estimate (~4 chars/token). Deterministic and dependency-free. */
export function estimateTokens(input: unknown): number {
  if (input == null) return 0;
  // Note: JSON.stringify("") is '""' (two quote chars), so nullish/empty input
  // must short-circuit rather than fall through to the serializer.
  const text = typeof input === "string" ? input : JSON.stringify(input) ?? "";
  return Math.ceil(text.length / 4);
}

/**
 * Estimated USD cost for a token count on a given model.
 * Returns 0 for the mock provider (no API call, no spend) and for unknown models.
 */
export function estimateCost(model: string, tokens: number): number {
  if (model === "mock") return 0;
  const rate = PRICE_PER_1K[model];
  if (!rate) return 0;
  return (tokens / 1000) * rate;
}
