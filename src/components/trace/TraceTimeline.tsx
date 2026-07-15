import { StepCard } from "@/components/trace/StepCard";
import { cn } from "@/lib/utils";
import type { RunDetailStep } from "@/lib/queries/runs";

// Node-marker color per step status (the dot on the timeline rail).
function dotClass(status: string): string {
  switch (status) {
    case "COMPLETED":
      return "bg-success";
    case "FAILED":
      return "bg-destructive";
    case "RUNNING":
      return "bg-warning";
    case "SKIPPED":
      return "bg-muted-foreground/40";
    default:
      return "bg-secondary-foreground/40";
  }
}

export function TraceTimeline({ steps }: { steps: RunDetailStep[] }) {
  if (steps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        This run has no recorded steps.
      </div>
    );
  }

  const stepMaxLatency = steps.reduce(
    (m, s) => Math.max(m, s.latencyMs ?? 0),
    0
  );

  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={step.id} className="relative pl-8">
          {/* connecting rail to the next node */}
          {i < steps.length - 1 && (
            <span className="absolute bottom-[-12px] left-[11px] top-5 w-px bg-border" />
          )}
          {/* status node marker */}
          <span
            className={cn(
              "absolute left-1.5 top-3.5 size-3 rounded-full ring-4 ring-background",
              dotClass(step.status)
            )}
          />
          <StepCard step={step} stepMaxLatency={stepMaxLatency} />
        </div>
      ))}
    </div>
  );
}
