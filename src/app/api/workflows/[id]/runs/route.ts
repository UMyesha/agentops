import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/queries/_common";
import {
  executeWorkflowRun,
  WorkflowNotFoundError,
} from "@/agents/runner";
import { WorkflowConfigError } from "@/agents/preflight";

const bodySchema = z.object({
  request: z.string().min(1).max(1000).optional(),
});

const DEFAULT_REQUEST =
  "Generate onboarding documentation for a new developer joining this repository.";

/**
 * POST /api/workflows/:id/runs — start a run.
 *
 * Synchronous by design: the pipeline is awaited, so the response carries the
 * run's terminal status. The only write route in Phase 3.
 *
 * 201 { runId, status }  · 400 invalid body · 401 unauthenticated
 * 404 workflow missing/not owned · 422 workflow or provider misconfigured
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = {}; // an empty body is fine; we fall back to the default request
  }

  const parsed = bodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const result = await executeWorkflowRun({
      workflowId: id,
      userId,
      request: parsed.data.request?.trim() || DEFAULT_REQUEST,
    });
    // Note: a run that executes and FAILS is still a 201 — the request
    // succeeded in creating a run; the run's outcome is data, not an HTTP error.
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof WorkflowNotFoundError) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }
    if (err instanceof WorkflowConfigError) {
      return NextResponse.json(
        { error: "Workflow is not runnable", issues: err.issues },
        { status: 422 }
      );
    }
    console.error("[api] run creation failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
