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

export interface RunWorkflowAgent {
  name: string;
  role: string;
}

function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Trigger a queued run. The workflow's agents and the configured provider are
 * passed in as plain props from the server-rendered workflow page (no extra API
 * route). Before submitting, the user sees exactly what will run and that
 * execution is asynchronous.
 */
export function RunWorkflowButton({
  workflowId,
  agents,
  provider,
}: {
  workflowId: string;
  agents: RunWorkflowAgent[];
  provider: string;
}) {
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
        const fallback =
          res.status === 503
            ? "Couldn't queue the run — the execution service may be unavailable."
            : `Request failed (${res.status})`;
        setError(`${body.error ?? fallback}${detail}`);
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
              className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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

          {/* What will run — agents + provider + async note. */}
          <div className="rounded-md border bg-muted/40 p-3 text-xs">
            <p className="font-medium text-foreground">
              This queues {agents.length} agents (provider:{" "}
              <span className="font-mono">{provider}</span>) and runs
              asynchronously.
            </p>
            <ol className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-muted-foreground">
              {agents.map((a, i) => (
                <li key={a.name} className="flex items-center gap-1">
                  <span className="tabular-nums">{i + 1}.</span>
                  <span>{a.name}</span>
                  <span className="text-muted-foreground/70">
                    ({roleLabel(a.role)})
                  </span>
                  {i < agents.length - 1 && (
                    <span className="text-muted-foreground/40">→</span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="size-4 motion-safe:animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {pending ? "Queuing…" : "Run workflow"}
            </Button>
            {pending && (
              <span className="text-xs text-muted-foreground">
                Enqueuing the run — you&apos;ll be taken to its trace page.
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
