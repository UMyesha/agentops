"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const POLL_INTERVAL_MS = 2000;
const TERMINAL = new Set(["COMPLETED", "FAILED", "RETRIED"]);

/**
 * Safety net for non-terminal runs.
 *
 * Phase 3 executes synchronously, so a run is already COMPLETED/FAILED by the
 * time you land on its page and this component does nothing. It exists so that
 * when Phase 5 moves execution onto a queue (runs arriving as QUEUED), the
 * trace page updates with no UI changes. It only reads the existing
 * GET /api/runs/:id endpoint — it never triggers execution.
 */
export function RunStatusPoller({
  runId,
  status,
}: {
  runId: string;
  status: string;
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

  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" />
      Run is {live.toLowerCase()} — this page refreshes automatically.
    </div>
  );
}
