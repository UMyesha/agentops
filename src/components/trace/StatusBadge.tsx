import {
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  Play,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusKey =
  // RunStatus
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "RETRIED"
  // StepStatus
  | "PENDING"
  | "SKIPPED"
  // ToolCallStatus
  | "SUCCESS"
  | "ERROR"
  // EvalResult
  | "PASS"
  | "FAIL";

const MAP: Record<
  StatusKey,
  { label: string; variant: BadgeProps["variant"]; icon: LucideIcon }
> = {
  QUEUED: { label: "Queued", variant: "secondary", icon: Clock },
  PENDING: { label: "Pending", variant: "secondary", icon: Clock },
  RUNNING: { label: "Running", variant: "warning", icon: Play },
  COMPLETED: { label: "Completed", variant: "success", icon: CheckCircle2 },
  SUCCESS: { label: "Success", variant: "success", icon: CheckCircle2 },
  PASS: { label: "Pass", variant: "success", icon: CheckCircle2 },
  FAILED: { label: "Failed", variant: "destructive", icon: XCircle },
  ERROR: { label: "Error", variant: "destructive", icon: XCircle },
  FAIL: { label: "Fail", variant: "destructive", icon: XCircle },
  SKIPPED: { label: "Skipped", variant: "outline", icon: MinusCircle },
  RETRIED: { label: "Retried", variant: "warning", icon: RotateCcw },
};

export function StatusBadge({
  status,
  className,
  showIcon = true,
}: {
  status: string;
  className?: string;
  showIcon?: boolean;
}) {
  const conf = MAP[status as StatusKey] ?? {
    label: status,
    variant: "secondary" as const,
    icon: MinusCircle,
  };
  const Icon = conf.icon;
  return (
    <Badge variant={conf.variant} className={cn("gap-1", className)}>
      {showIcon && <Icon className="size-3" />}
      {conf.label}
    </Badge>
  );
}

/** The Badge variant a given status maps to — reused by timeline node markers. */
export function statusVariant(status: string): BadgeProps["variant"] {
  return MAP[status as StatusKey]?.variant ?? "secondary";
}
