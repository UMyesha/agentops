import Link from "next/link";
import { redirect } from "next/navigation";
import { Gauge, ListChecks, TrendingDown } from "lucide-react";
import { getSessionUserId } from "@/lib/queries/_common";
import {
  listEvaluations,
  type EvaluationHistoryItem,
} from "@/lib/queries/evaluations";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { StatusBadge } from "@/components/trace/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, timeAgo } from "@/lib/utils";

function scoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

function EvalRow({ e }: { e: EvaluationHistoryItem }) {
  return (
    <li>
      <Link
        href={`/runs/${e.runId}`}
        className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-muted/50"
      >
        <span
          className={cn(
            "w-10 text-lg font-semibold tabular-nums",
            scoreColor(e.score)
          )}
        >
          {e.score}
        </span>
        <StatusBadge status={e.result} />
        <span className="text-sm font-medium">{e.workflowName}</span>
        {e.failedCriteria.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {e.failedCriteria.map((c) => (
              <Badge key={c} variant="outline" className="text-destructive">
                {c}
              </Badge>
            ))}
          </div>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {timeAgo(e.createdAt)}
        </span>
      </Link>
    </li>
  );
}

export default async function EvaluationsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const view = await listEvaluations(userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Evaluations</h1>
        <p className="text-sm text-muted-foreground">
          Rubric-based scoring of workflow outputs.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Average score"
          value={view.avgScore != null ? view.avgScore : "—"}
          sub="out of 100"
          icon={Gauge}
        />
        <MetricCard
          label="Pass rate"
          value={view.passRate != null ? `${view.passRate}%` : "—"}
          icon={ListChecks}
          accent="success"
        />
        <MetricCard
          label="Evaluated runs"
          value={view.count}
          icon={ListChecks}
        />
      </div>

      {/* Low-scoring runs */}
      {view.lowScoring.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <TrendingDown className="size-4 text-destructive" />
            <CardTitle className="text-base">Low-scoring runs</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {view.lowScoring.map((e) => (
                <EvalRow key={e.id} e={e} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evaluation history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {view.evaluations.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted-foreground">
              No evaluations yet.
            </p>
          ) : (
            <ul className="divide-y">
              {view.evaluations.map((e) => (
                <EvalRow key={e.id} e={e} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
