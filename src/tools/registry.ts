import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { ToolError } from "@/tools/errors";
import type { MockRepo, ToolDefinition, ToolName } from "@/types";
import * as repoTools from "@/tools/impl/repoTools";
import * as outputTools from "@/tools/impl/outputTools";
import * as S from "@/tools/schemas";

// ─── Registry ────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
const NO_PARAMS = { type: "object", properties: {}, required: [] } as const;

export const TOOLS: Record<ToolName, ToolDefinition<any, any>> = {
  listRepoFiles: {
    name: "listRepoFiles",
    description: "List all file paths in the target repository.",
    inputSchema: S.listRepoFilesInput,
    outputSchema: S.listRepoFilesOutput,
    jsonSchema: { ...NO_PARAMS },
    run: repoTools.listRepoFiles,
  },
  readFile: {
    name: "readFile",
    description: "Read the full contents of a single file by path.",
    inputSchema: S.readFileInput,
    outputSchema: S.readFileOutput,
    jsonSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repository-relative file path." },
      },
      required: ["path"],
    },
    run: repoTools.readFile,
  },
  searchFiles: {
    name: "searchFiles",
    description:
      "Search file contents for a query string; returns matching paths and snippets.",
    inputSchema: S.searchFilesInput,
    outputSchema: S.searchFilesOutput,
    jsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Substring to search for." },
      },
      required: ["query"],
    },
    run: repoTools.searchFiles,
  },
  getPackageJson: {
    name: "getPackageJson",
    description: "Return the parsed package.json of the repository.",
    inputSchema: S.getPackageJsonInput,
    outputSchema: S.getPackageJsonOutput,
    jsonSchema: { ...NO_PARAMS },
    run: repoTools.getPackageJson,
  },
  validateOutput: {
    name: "validateOutput",
    description:
      "Validate the onboarding document contains all required sections.",
    inputSchema: S.validateOutputInput,
    outputSchema: S.validateOutputOutput,
    jsonSchema: {
      type: "object",
      properties: {
        document: {
          type: "object",
          description: "The onboarding document to validate.",
        },
      },
      required: ["document"],
    },
    run: outputTools.validateOutput,
  },
  scoreOutput: {
    name: "scoreOutput",
    description: "Score the onboarding document against the evaluation rubric.",
    inputSchema: S.scoreOutputInput,
    outputSchema: S.scoreOutputOutput,
    jsonSchema: {
      type: "object",
      properties: {
        document: {
          type: "object",
          description: "The onboarding document to score.",
        },
      },
      required: ["document"],
    },
    run: outputTools.scoreOutput,
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export function isToolName(name: string): name is ToolName {
  return name in TOOLS;
}

const json = (v: unknown): Prisma.InputJsonValue =>
  (v === undefined ? null : v) as Prisma.InputJsonValue;

// ─── runTool ─────────────────────────────────────────────────────────────────

export interface RunToolOptions {
  /** May be an arbitrary string — providers can hallucinate names. */
  name: string;
  input: unknown;
  runId: string;
  stepId: string;
  repo: MockRepo;
  /** The current agent's allowlist. Enforced, not advisory. */
  allowed: readonly ToolName[];
  userId?: string | null;
}

/**
 * The single place a tool call is executed AND persisted.
 *
 * Every exit path writes a ToolCall row: SUCCESS with the output, or ERROR with
 * the message — the ERROR row is always written *before* the failure propagates,
 * so a failed run still shows exactly which call broke it.
 */
export async function runTool(opts: RunToolOptions): Promise<unknown> {
  const { name, input, runId, stepId, repo, allowed, userId } = opts;
  const startedAt = new Date();

  const fail = async (err: ToolError): Promise<never> => {
    const completedAt = new Date();
    await db.toolCall.create({
      data: {
        runId,
        stepId,
        toolName: name,
        status: "ERROR",
        input: json(input),
        output: Prisma.JsonNull,
        error: err.message,
        latencyMs: completedAt.getTime() - startedAt.getTime(),
        startedAt,
        completedAt,
      },
    });
    await logAudit({
      userId,
      action: "tool.failed",
      entity: "ToolCall",
      entityId: `${runId}:${name}`,
      metadata: { runId, stepId, toolName: name, kind: err.kind, message: err.message },
    });
    throw err;
  };

  // 1. Allowlist — enforced before anything executes.
  if (!isToolName(name) || !allowed.includes(name)) {
    return fail(
      new ToolError(
        name,
        "not_allowed",
        `Tool "${name}" is not available to this agent. Allowed: ${allowed.join(", ")}`
      )
    );
  }

  const tool = TOOLS[name];

  // 2. Validate input.
  const parsedInput = tool.inputSchema.safeParse(input);
  if (!parsedInput.success) {
    return fail(
      new ToolError(
        name,
        "invalid_input",
        `Invalid input for "${name}": ${parsedInput.error.issues
          .map((i) => `${i.path.join(".") || "(root)"} ${i.message}`)
          .join("; ")}`
      )
    );
  }

  // 3. Execute.
  let raw: unknown;
  try {
    raw = await tool.run(parsedInput.data, { repo });
  } catch (err) {
    return fail(
      err instanceof ToolError
        ? err
        : new ToolError(
            name,
            "execution",
            err instanceof Error ? err.message : String(err)
          )
    );
  }

  // 4. Validate output.
  const parsedOutput = tool.outputSchema.safeParse(raw);
  if (!parsedOutput.success) {
    return fail(
      new ToolError(
        name,
        "invalid_output",
        `Invalid output from "${name}": ${parsedOutput.error.issues
          .map((i) => `${i.path.join(".") || "(root)"} ${i.message}`)
          .join("; ")}`
      )
    );
  }

  // 5. Persist success.
  const completedAt = new Date();
  await db.toolCall.create({
    data: {
      runId,
      stepId,
      toolName: name,
      status: "SUCCESS",
      input: json(parsedInput.data),
      output: json(parsedOutput.data),
      latencyMs: completedAt.getTime() - startedAt.getTime(),
      startedAt,
      completedAt,
    },
  });

  return parsedOutput.data;
}
