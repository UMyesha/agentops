"use client";

import * as React from "react";
import { ChevronRight, AlertTriangle, Wrench } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StatusBadge } from "@/components/trace/StatusBadge";
import { LatencyDisplay } from "@/components/trace/LatencyDisplay";
import { JsonViewer } from "@/components/trace/JsonViewer";
import { ToolCallRow } from "@/components/trace/ToolCallRow";
import { cn } from "@/lib/utils";
import type { RunDetailStep } from "@/lib/queries/runs";

function fmtTime(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function StepCard({
  step,
  stepMaxLatency,
}: {
  step: RunDetailStep;
  /** Slowest step latency in the run — for the header latency bar. */
  stepMaxLatency?: number;
}) {
  const skipped = step.status === "SKIPPED";
  const failed = step.status === "FAILED";
  const [open, setOpen] = React.useState(failed); // failed steps open by default

  const maxToolLatency = step.toolCalls.reduce(
    (m, t) => Math.max(m, t.latencyMs ?? 0),
    0
  );

  const header = (
    <>
      <ChevronRight
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform",
          open && "rotate-90",
          skipped && "invisible"
        )}
      />
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold tabular-nums">
        {step.order}
      </span>
      <span className={cn("font-medium", skipped && "text-muted-foreground")}>
        {step.agent.name}
      </span>
      <StatusBadge status={step.status} />
      {step.toolCalls.length > 0 && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Wrench className="size-3" />
          {step.toolCalls.length}
        </span>
      )}
      <div className="ml-auto flex items-center gap-4">
        {!skipped && (
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
            {fmtTime(step.startedAt)}
          </span>
        )}
        {!skipped && (
          <LatencyDisplay ms={step.latencyMs} max={stepMaxLatency} showBar />
        )}
      </div>
    </>
  );

  // Skipped steps carry no timing/output — render a static muted row.
  if (skipped) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-3 py-2.5">
        {header}
      </div>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "rounded-lg border bg-card shadow-sm",
        failed && "border-destructive/50"
      )}
    >
      <CollapsibleTrigger className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        {header}
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4 border-t px-4 py-4">
        {failed && step.error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-medium">Step failed</p>
              <p className="mt-0.5 font-mono text-xs">{step.error}</p>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Input
            </p>
            <JsonViewer data={step.input} defaultOpen={false} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Output
            </p>
            <JsonViewer data={step.output} defaultOpen={false} />
          </div>
        </div>

        {step.toolCalls.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Tool calls ({step.toolCalls.length})
            </p>
            <div className="space-y-1.5">
              {step.toolCalls.map((tc) => (
                <ToolCallRow
                  key={tc.id}
                  toolCall={tc}
                  maxLatency={maxToolLatency}
                />
              ))}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
