"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const DEFAULT_REQUEST =
  "Generate onboarding documentation for a new developer joining this repository.";

interface ApiError {
  error?: string;
  issues?: unknown;
}

export function RunWorkflowButton({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [request, setRequest] = React.useState(DEFAULT_REQUEST);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as ApiError;
        const detail = Array.isArray(body.issues)
          ? ` ${(body.issues as string[]).join(" ")}`
          : "";
        setError(`${body.error ?? `Request failed (${res.status})`}${detail}`);
        setPending(false);
        return;
      }

      const { runId } = (await res.json()) as { runId: string };
      router.push(`/runs/${runId}`);
      router.refresh();
    } catch {
      setError("Could not reach the server. Is the app still running?");
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Play className="size-4" />
        Run workflow
      </Button>
    );
  }

  return (
    <Card className="w-full max-w-xl">
      <CardContent className="p-4">
        <form onSubmit={submit} className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="request" className="text-sm font-medium">
              Onboarding request
            </label>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              aria-label="Cancel"
            >
              <X className="size-4" />
            </button>
          </div>

          <textarea
            id="request"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={3}
            maxLength={1000}
            required
            disabled={pending}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {pending ? "Running pipeline…" : "Run workflow"}
            </Button>
            {pending && (
              <span className="text-xs text-muted-foreground">
                Executing five agents — this runs synchronously.
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
