import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/queries/_common";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { createQueuedRun, WorkflowNotFoundError } from "@/agents/runner";
import { WorkflowConfigError } from "@/agents/preflight";
import { enqueueAgentRun } from "@/queue/agentRunQueue";

const bodySchema = z.object({
  request: z.string().min(1).max(1000).optional(),
});

const DEFAULT_REQUEST =
  "Generate onboarding documentation for a new developer joining this repository.";

/**
 * POST /api/workflows/:id/runs — enqueue a run (async).
 *
 * Creates a QUEUED AgentRun, enqueues one BullMQ job (jobId = runId), and
 * returns 202 immediately. A standalone worker executes it; the client polls
 * QUEUED → RUNNING → COMPLETED|FAILED on the Run Detail page.
 *
 * 202 { runId, status:"QUEUED" } · 400 invalid body · 401 unauthenticated
 * 404 workflow missing/not owned · 422 workflow/provider misconfigured
 * 503 enqueue failed (the created run is marked FAILED — never left QUEUED)
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
    raw = {};
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
  const request = parsed.data.request?.trim() || DEFAULT_REQUEST;

  // 1. Create the QUEUED run (preflight runs here → 404 / 422 before enqueue).
  let runId: string;
  try {
    ({ runId } = await createQueuedRun({ workflowId: id, userId, request }));
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
    console.error("[api] createQueuedRun failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  // 2. Enqueue. If Redis/enqueue fails after the run exists, mark the run FAILED
  //    (never leave it indefinitely QUEUED) and return 503. No in-request retry.
  try {
    await enqueueAgentRun({ runId, userId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await db.agentRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          failureReason: `Queue enqueue failed: ${message}`,
          completedAt: new Date(),
        },
      });
    } catch (dbErr) {
      console.error("[api] failed to mark run FAILED after enqueue error:", dbErr);
    }
    await logAudit({
      userId,
      action: "run.enqueue_failed",
      entity: "AgentRun",
      entityId: runId,
      metadata: { message },
    });
    return NextResponse.json(
      { runId, error: "Failed to enqueue run for execution" },
      { status: 503 }
    );
  }

  await logAudit({
    userId,
    action: "run.queued",
    entity: "AgentRun",
    entityId: runId,
  });
  return NextResponse.json({ runId, status: "QUEUED" }, { status: 202 });
}
