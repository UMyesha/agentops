import { describe, it, expect } from "vitest";
import { estimateTokens, estimateCost } from "@/lib/metrics";

describe("estimateTokens", () => {
  it("is deterministic", () => {
    expect(estimateTokens("hello world")).toBe(estimateTokens("hello world"));
  });

  it("grows with input size", () => {
    expect(estimateTokens("a".repeat(400))).toBeGreaterThan(
      estimateTokens("a".repeat(40))
    );
  });

  it("handles objects and nullish input", () => {
    expect(estimateTokens({ a: 1 })).toBeGreaterThan(0);
    expect(estimateTokens(null)).toBe(0);
    expect(estimateTokens(undefined)).toBe(0);
  });
});

describe("estimateCost", () => {
  it("reports ZERO for mock runs — they make no API calls and cost nothing", () => {
    expect(estimateCost("mock", 0)).toBe(0);
    expect(estimateCost("mock", 6180)).toBe(0);
    expect(estimateCost("mock", 1_000_000)).toBe(0);
  });

  it("prices real models per 1K tokens", () => {
    expect(estimateCost("gpt-4o-mini", 1000)).toBeCloseTo(0.00026, 6);
    expect(estimateCost("gpt-4o-mini", 2000)).toBeCloseTo(0.00052, 6);
    expect(estimateCost("gpt-4o", 1000)).toBeCloseTo(0.00438, 6);
  });

  it("returns 0 for unknown models rather than guessing", () => {
    expect(estimateCost("some-unreleased-model", 5000)).toBe(0);
  });
});
