"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { runStatusCopy } from "@/lib/runStatusCopy";

const POLL_INTERVAL_MS = 2000;
const TERMINAL = new Set(["COMPLETED", "FAILED", "RETRIED"]);

/**
 * Live status strip for non-terminal runs. Polls the existing GET /api/runs/:id
 * endpoint (never triggers execution) and refreshes the page when the status
 * changes. Copy is derived from persisted fields via `runStatusCopy` and
 * announced with `aria-live="polite"`.
 */
export function RunStatusPoller({
  runId,
  status,
  retryCount = 0,
}: {
  runId: string;
  status: string;
  retryCount?: number;
}) {
  const router = useRouter();
  const [live, setLive] = React.useState(status);

  React.useEffect(() => {
    if (TERMINAL.has(live)) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
        if (!res.ok) return;
        const run = (await res.json()) as { status: string };
        if (cancelled) return;
        if (run.status !== live) {
          setLive(run.status);
          router.refresh();
        }
      } catch {
        // transient network error — keep polling
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [runId, live, router]);

  if (TERMINAL.has(live)) return null;

  const copy = runStatusCopy({ status: live, retryCount });

  return (
    <div
      aria-live="polite"
      className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
    >
      <Loader2 className="size-3.5 motion-safe:animate-spin" />
      <span>
        <span className="font-medium text-foreground">{copy.label}</span> —{" "}
        {copy.detail} This page refreshes automatically.
      </span>
    </div>
  );
}
