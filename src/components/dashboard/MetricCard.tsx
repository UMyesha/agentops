import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  tooltip,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: LucideIcon;
  accent?: "success" | "warning" | "destructive";
  tooltip?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
            {label}
            {tooltip && <InfoTooltip text={tooltip} />}
          </p>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums",
              accent === "success" && "text-success",
              accent === "warning" && "text-warning",
              accent === "destructive" && "text-destructive"
            )}
          >
            {value}
          </p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
          <Icon className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}
