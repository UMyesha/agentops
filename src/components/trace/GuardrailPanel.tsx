import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { JsonViewer } from "@/components/trace/JsonViewer";
import type { GuardrailViolation } from "@prisma/client";

// Higher-severity guardrail types render destructive; the rest render warning.
const SEVERE = new Set([
  "TOOL_FAILURE",
  "EMPTY_OUTPUT",
  "MALFORMED_OUTPUT",
  "UNSAFE_RESPONSE",
]);

function label(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function GuardrailPanel({
  violations,
}: {
  violations: GuardrailViolation[];
}) {
  if (violations.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <ShieldCheck className="mx-auto mb-2 size-6 text-success" />
        <p className="text-sm text-muted-foreground">
          No guardrail violations for this run.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {violations.map((v) => (
        <li key={v.id} className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert
              className={
                SEVERE.has(v.type) ? "size-4 text-destructive" : "size-4 text-warning"
              }
            />
            <Badge variant={SEVERE.has(v.type) ? "destructive" : "warning"}>
              {label(v.type)}
            </Badge>
            {v.stepId && (
              <span className="font-mono text-xs text-muted-foreground">
                step {v.stepId.slice(0, 8)}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm">{v.message}</p>
          {v.details != null && (
            <div className="mt-2">
              <JsonViewer data={v.details} defaultOpen={false} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
