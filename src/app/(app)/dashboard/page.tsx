import { redirect } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Timer,
  Gauge,
  ShieldAlert,
  RotateCcw,
  Loader2,
  Rocket,
} from "lucide-react";
import { getSessionUserId } from "@/lib/queries/_common";
import { getDashboardMetrics } from "@/lib/queries/dashboard";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RecentRuns } from "@/components/dashboard/RecentRuns";
import { RecentErrors } from "@/components/dashboard/RecentErrors";
import { EmptyState } from "@/components/EmptyState";
import { formatLatency } from "@/lib/utils";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const m = await getDashboardMetrics(userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Observability overview for your agent runs.
        </p>
      </div>

      {m.totalRuns === 0 ? (
        <EmptyState
          icon={Rocket}
          title="No runs yet"
          description="Follow Project → Workflow → Run to execute the Repository Onboarding workflow, then inspect its full trace here."
          action={{ label: "Go to projects", href: "/projects" }}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Total runs" value={m.totalRuns} icon={Activity} />
            <MetricCard
              label="Success rate"
              value={m.successRate != null ? `${m.successRate}%` : "—"}
              sub={`${m.completedRuns} completed`}
              icon={CheckCircle2}
              accent="success"
            />
            <MetricCard
              label="Failed runs"
              value={m.failedRuns}
              icon={XCircle}
              accent={m.failedRuns > 0 ? "destructive" : undefined}
            />
            <MetricCard
              label="Active runs"
              value={m.activeRunCount}
              sub="queued or running"
              icon={Loader2}
              tooltip="Runs currently QUEUED or RUNNING and awaiting a terminal state."
            />
            <MetricCard
              label="Avg latency"
              value={formatLatency(m.avgCompletedLatencyMs)}
              sub="completed runs"
              icon={Timer}
              tooltip="Average total latency across COMPLETED runs only; in-flight and failed runs are excluded."
            />
            <MetricCard
              label="Avg eval score"
              value={m.avgEvalScore != null ? m.avgEvalScore : "—"}
              sub="out of 100"
              icon={Gauge}
              tooltip="Mean evaluation score across all runs that have an evaluation result."
            />
            <MetricCard
              label="Retried runs"
              value={m.retriedRunCount}
              sub="≥ 1 retry attempt"
              icon={RotateCcw}
              tooltip="Runs whose retryCount is greater than zero — at least one retry was recorded."
            />
            <MetricCard
              label="Guardrail hits"
              value={m.guardrailCount}
              sub="violations recorded"
              icon={ShieldAlert}
              accent={m.guardrailCount > 0 ? "warning" : undefined}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <RecentRuns runs={m.recentRuns} />
            <RecentErrors errors={m.recentErrors} />
          </div>
        </>
      )}
    </div>
  );
}
