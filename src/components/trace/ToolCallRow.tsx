"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Wrench, AlertTriangle, ExternalLink } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StatusBadge } from "@/components/trace/StatusBadge";
import { LatencyDisplay } from "@/components/trace/LatencyDisplay";
import { JsonViewer } from "@/components/trace/JsonViewer";
import { cn } from "@/lib/utils";
import type { RunDetailToolCall } from "@/lib/queries/runs";

export function ToolCallRow({
  toolCall,
  maxLatency,
}: {
  toolCall: RunDetailToolCall;
  maxLatency?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const isError = toolCall.status === "ERROR";

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "rounded-md border bg-card",
        isError && "border-destructive/40"
      )}
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        <Wrench className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="font-mono text-xs font-medium">{toolCall.toolName}</span>
        <StatusBadge status={toolCall.status} className="ml-1" />
        <div className="ml-auto flex items-center gap-3">
          <LatencyDisplay ms={toolCall.latencyMs} max={maxLatency} showBar />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3 border-t px-3 py-3">
        {isError && toolCall.error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span className="font-mono">{toolCall.error}</span>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Input
            </p>
            <JsonViewer data={toolCall.input} defaultOpen={false} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Output
            </p>
            <JsonViewer data={toolCall.output} defaultOpen={false} />
          </div>
        </div>
        <Link
          href={`/tool-calls/${toolCall.id}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="size-3" />
          Open tool call detail
        </Link>
      </CollapsibleContent>
    </Collapsible>
  );
}
