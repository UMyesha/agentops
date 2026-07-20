import {
  CircleDot,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import type { RunAuditEntry } from "@/lib/queries/runs";
import { timeAgo } from "@/lib/utils";

// Presentation for each execution-lifecycle audit action. Labels are safe,
// generic phrasings — no internal error strings are surfaced here (the failure
// banner shows the persisted failureReason separately).
const ACTION_META: Record<string, { label: string; icon: LucideIcon }> = {
  "run.queued": { label: "Queued for execution", icon: Inbox },
  "run.enqueue_failed": { label: "Enqueue failed", icon: XCircle },
  "run.worker_started": { label: "Worker started", icon: Play },
  "run.retry_scheduled": { label: "Retry scheduled", icon: RotateCcw },
  "run.worker_completed": { label: "Completed", icon: CheckCircle2 },
  "run.worker_failed": { label: "Failed", icon: XCircle },
};

function attemptSuffix(entry: RunAuditEntry): string | null {
  const meta = entry.metadata;
  if (meta && typeof meta === "object" && "retryAttempt" in meta) {
    const n = (meta as { retryAttempt?: unknown }).retryAttempt;
    // `retryAttempt` is the CANONICAL 1-based execution attempt number, computed
    // once in the worker as `job.attemptsMade + 1` and persisted verbatim in the
    // audit metadata. It is already the attempt number — do NOT increment again
    // here, or a first execution (retryAttempt 1) renders as "attempt 2".
    if (typeof n === "number" && Number.isFinite(n) && n >= 1) {
      return `attempt ${n}`;
    }
  }
  return null;
}

/**
 * Compact execution/retry history built from persisted AuditLog rows. Renders
 * nothing when there is no trail (e.g. seeded runs predating audit capture).
 */
export function RunAuditTrail({ entries }: { entries: RunAuditEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Execution history
      </h2>
      <ol className="space-y-2 rounded-lg border bg-card p-4">
        {entries.map((entry) => {
          const meta = ACTION_META[entry.action] ?? {
            label: entry.action,
            icon: CircleDot,
          };
          const Icon = meta.icon;
          const suffix = attemptSuffix(entry);
          return (
            <li key={entry.id} className="flex items-center gap-2.5 text-sm">
              <Icon className="size-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">{meta.label}</span>
              {suffix && (
                <span className="text-xs text-muted-foreground">({suffix})</span>
              )}
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {timeAgo(entry.createdAt)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
