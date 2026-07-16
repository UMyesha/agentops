import type { ToolName } from "@/types";

/**
 * Raised for any tool-call failure: allowlist violation, input/output schema
 * violation, or an error thrown by the implementation. The runner treats a
 * ToolError as a step failure.
 */
export class ToolError extends Error {
  readonly toolName: string;
  readonly kind: "not_allowed" | "invalid_input" | "invalid_output" | "execution";

  constructor(
    toolName: ToolName | string,
    kind: ToolError["kind"],
    message: string
  ) {
    super(message);
    this.name = "ToolError";
    this.toolName = toolName;
    this.kind = kind;
  }
}
