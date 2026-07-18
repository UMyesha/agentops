import { describe, it, expect } from "vitest";
import {
  classifyError,
  isRetryable,
  RetryableRunError,
  NonRetryableRunError,
} from "@/agents/errors";
import { ToolError } from "@/tools/errors";

describe("classifyError", () => {
  it("marker classes take priority", () => {
    expect(classifyError(new RetryableRunError("x"))).toBe("retryable");
    expect(classifyError(new NonRetryableRunError("x"))).toBe("non_retryable");
  });

  it("deterministic tool failures are non-retryable", () => {
    expect(classifyError(new ToolError("readFile", "execution", "ENOENT"))).toBe(
      "non_retryable"
    );
  });

  it("transient HTTP statuses are retryable (408/429/5xx)", () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      expect(classifyError({ status })).toBe("retryable");
    }
    expect(classifyError({ status: 400 })).toBe("non_retryable");
    expect(classifyError({ status: 401 })).toBe("non_retryable");
    expect(classifyError({ status: 404 })).toBe("non_retryable");
  });

  it("reads a nested response.status (OpenAI SDK shape)", () => {
    expect(classifyError({ response: { status: 429 } })).toBe("retryable");
    expect(classifyError({ response: { status: 400 } })).toBe("non_retryable");
  });

  it("transient Node error codes are retryable", () => {
    for (const code of ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN"]) {
      expect(classifyError({ code })).toBe("retryable");
    }
    expect(classifyError({ code: "EACCES" })).toBe("non_retryable");
  });

  it("defaults unknown errors to non-retryable (never retry an arbitrary Error)", () => {
    expect(classifyError(new Error("mystery"))).toBe("non_retryable");
    expect(classifyError("a string")).toBe("non_retryable");
    expect(classifyError(null)).toBe("non_retryable");
    expect(classifyError(undefined)).toBe("non_retryable");
  });

  it("isRetryable mirrors classifyError", () => {
    expect(isRetryable(new RetryableRunError("x"))).toBe(true);
    expect(isRetryable(new Error("x"))).toBe(false);
  });
});
