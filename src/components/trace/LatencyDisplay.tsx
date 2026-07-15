import { Clock } from "lucide-react";
import { cn, formatLatency } from "@/lib/utils";

/**
 * Latency value with an optional proportional bar. When `max` is provided the
 * bar width is relative to it (e.g. the slowest step in a run), giving a quick
 * visual sense of where time went.
 */
export function LatencyDisplay({
  ms,
  max,
  showBar = false,
  showIcon = false,
  className,
}: {
  ms: number | null | undefined;
  max?: number;
  showBar?: boolean;
  showIcon?: boolean;
  className?: string;
}) {
  const pct =
    showBar && max && ms != null && max > 0
      ? Math.max(2, Math.round((ms / max) * 100))
      : null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showIcon && <Clock className="size-3 text-muted-foreground" />}
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {formatLatency(ms)}
      </span>
      {pct != null && (
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary/60"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
