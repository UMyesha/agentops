"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Re-runs the rubric over a completed run's stored final output and upserts the
 * single EvaluationResult. Rendered only for eligible runs (completed + has a
 * final output).
 */
export function ReevaluateButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function reevaluate() {
    setPending(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch(`/api/runs/${runId}/evaluate`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Re-evaluation failed (${res.status})`);
        setPending(false);
        return;
      }
      setDone(true);
      setPending(false);
      router.refresh(); // pull the updated EvaluationResult into the panel
      setTimeout(() => setDone(false), 2000);
    } catch {
      setError("Could not reach the server.");
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={reevaluate}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : done ? (
          <Check className="size-4 text-success" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {pending ? "Re-evaluating…" : done ? "Updated" : "Re-evaluate"}
      </Button>
      {error && (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="size-3.5" />
          {error}
        </span>
      )}
    </div>
  );
}
