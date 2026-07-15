import { redirect } from "next/navigation";
import { Activity, CheckCircle2, XCircle, Timer, Gauge } from "lucide-react";
import { getSessionUserId } from "@/lib/queries/_common";
import { getDashboardMetrics } from "@/lib/queries/dashboard";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { RecentRuns } from "@/components/dashboard/RecentRuns";
import { RecentErrors } from "@/components/dashboard/RecentErrors";
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          label="Total runs"
          value={m.totalRuns}
          icon={Activity}
        />
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
          label="Avg latency"
          value={formatLatency(m.avgCompletedLatencyMs)}
          sub="completed runs"
          icon={Timer}
        />
        <MetricCard
          label="Avg eval score"
          value={m.avgEvalScore != null ? m.avgEvalScore : "—"}
          sub="out of 100"
          icon={Gauge}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentRuns runs={m.recentRuns} />
        <RecentErrors errors={m.recentErrors} />
      </div>
    </div>
  );
}
