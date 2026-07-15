import { Check, X, ClipboardCheck } from "lucide-react";
import { StatusBadge } from "@/components/trace/StatusBadge";
import { cn } from "@/lib/utils";
import type { EvaluationResult } from "@prisma/client";
import type { RubricCriterion } from "@/types";

function scoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

export function EvaluationPanel({
  evaluation,
}: {
  evaluation: EvaluationResult | null;
}) {
  if (!evaluation) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <ClipboardCheck className="mx-auto mb-2 size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          This run was not evaluated.
        </p>
      </div>
    );
  }

  // rubric is stored as JSON; it conforms to RubricCriterion[].
  const rubric = (evaluation.rubric as unknown as RubricCriterion[]) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-6 rounded-lg border bg-card p-5">
        <div className="text-center">
          <div
            className={cn(
              "text-4xl font-bold tabular-nums",
              scoreColor(evaluation.score)
            )}
          >
            {evaluation.score}
          </div>
          <div className="text-xs text-muted-foreground">/ 100</div>
        </div>
        <div className="space-y-2">
          <StatusBadge status={evaluation.result} />
          <p className="text-sm text-muted-foreground">{evaluation.feedback}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Rubric</p>
        <ul className="divide-y rounded-lg border">
          {rubric.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-4 py-2.5">
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                  c.passed
                    ? "bg-success/15 text-success"
                    : "bg-destructive/15 text-destructive"
                )}
              >
                {c.passed ? (
                  <Check className="size-3.5" />
                ) : (
                  <X className="size-3.5" />
                )}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">{c.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {c.weight} pts
                  </span>
                </div>
                {c.note && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.note}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
