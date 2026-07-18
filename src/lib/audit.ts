import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type AuditAction =
  | "run.created"
  | "run.started"
  | "tool.failed"
  | "run.completed"
  | "run.failed"
  | "evaluation.created"
  | "evaluation.updated"
  | "guardrails.completed"
  | "guardrail.violation_created"
  // Phase 5 — queued execution & retries
  | "run.queued"
  | "run.enqueue_failed"
  | "run.worker_started"
  | "run.retry_scheduled"
  | "run.worker_completed"
  | "run.worker_failed";

/**
 * Append an AuditLog row.
 *
 * Deliberately non-fatal: observability plumbing must never be able to fail the
 * run it is observing. A failed audit write is logged and swallowed.
 */
export async function logAudit(entry: {
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId: string;
  metadata?: unknown;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        metadata:
          entry.metadata === undefined
            ? Prisma.JsonNull
            : (entry.metadata as Prisma.InputJsonValue),
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log:", entry.action, err);
  }
}
