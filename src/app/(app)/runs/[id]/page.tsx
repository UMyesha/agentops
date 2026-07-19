import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Workflow as WorkflowIcon, AlertTriangle } from "lucide-react";
import { getSessionUserId } from "@/lib/queries/_common";
import {
  getRunDetail,
  getRunAuditTrail,
  retryableSignalFrom,
} from "@/lib/queries/runs";
import { runStatusCopy, isEnqueueFailure } from "@/lib/runStatusCopy";
import { StatusBadge } from "@/components/trace/StatusBadge";
import { RunStatusPoller } from "@/components/runs/RunStatusPoller";
import { RunAuditTrail } from "@/components/runs/RunAuditTrail";
import { ReevaluateButton } from "@/components/runs/ReevaluateButton";
import { TraceTimeline } from "@/components/trace/TraceTimeline";
import { EvaluationPanel } from "@/components/trace/EvaluationPanel";
import { GuardrailPanel } from "@/components/trace/GuardrailPanel";
import { FinalOutputViewer } from "@/components/trace/FinalOutputViewer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { formatCost, formatLatency, formatNumber } from "@/lib/utils";

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const [run, auditTrail] = await Promise.all([
    getRunDetail(id, userId),
    getRunAuditTrail(id, userId),
  ]);
  if (!run) notFound();

  const guardrailCount = run.guardrails.length;
  const enqueueFailed = isEnqueueFailure(run.failureReason);
  const copy = runStatusCopy({
    status: run.status,
    retryCount: run.retryCount,
    failureReason: run.failureReason,
    retryable: retryableSignalFrom(auditTrail),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/runs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to runs
      </Link>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">Run</h1>
          <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {run.id}
          </code>
          <StatusBadge status={run.status} />
        </div>
        <Link
          href={`/workflows/${run.workflow.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <WorkflowIcon className="size-4" />
          {run.workflow.name}
        </Link>
      </div>

      {/* Safety net: refreshes the page if the run is still in flight. */}
      <RunStatusPoller
        runId={run.id}
        status={run.status}
        retryCount={run.retryCount}
      />

      {/* Enqueue-failure banner: the run never reached a worker. */}
      {enqueueFailed && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Couldn&apos;t queue this run</p>
            <p className="mt-0.5">
              The execution service may be unavailable, so the run was never
              picked up by a worker. Try running the workflow again once the
              worker is back.
            </p>
          </div>
        </div>
      )}

      {/* Failure banner (non-enqueue failures): show status copy + reason. */}
      {run.status === "FAILED" && !enqueueFailed && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">{copy.detail}</p>
          {run.failureReason && (
            <p className="mt-0.5 text-destructive/90">{run.failureReason}</p>
          )}
        </div>
      )}

      {/* Metadata */}
      <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-5 sm:grid-cols-3 lg:grid-cols-6">
        <Meta label="Total latency" value={formatLatency(run.totalLatencyMs)} />
        <Meta label="Est. tokens" value={formatNumber(run.estTokens)} />
        <Meta label="Est. cost" value={formatCost(run.estCostUsd)} />
        <Meta label="Model" value={run.model ?? "—"} />
        <Meta label="Retries" value={run.retryCount} />
        <Meta label="Steps" value={run.steps.length} />
      </dl>

      {/* Execution / retry history from the audit log. */}
      <RunAuditTrail entries={auditTrail} />

      {/* Trace timeline — the core */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Trace timeline
          </h2>
          <Separator className="flex-1" />
        </div>
        <TraceTimeline steps={run.steps} />
      </section>

      {/* Output / Evaluation / Guardrails */}
      <Tabs defaultValue="output" className="pt-2">
        <TabsList>
          <TabsTrigger value="output">Final Output</TabsTrigger>
          <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
          <TabsTrigger value="guardrails">
            Guardrails
            {guardrailCount > 0 && (
              <span className="ml-1 rounded-full bg-muted-foreground/20 px-1.5 text-xs">
                {guardrailCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="output">
          <FinalOutputViewer output={run.finalOutput} />
        </TabsContent>
        <TabsContent value="evaluation" className="space-y-4">
          {run.status === "COMPLETED" && run.finalOutput != null && (
            <div className="flex items-center justify-end">
              <ReevaluateButton runId={run.id} />
            </div>
          )}
          <EvaluationPanel evaluation={run.evaluation} />
        </TabsContent>
        <TabsContent value="guardrails">
          <GuardrailPanel violations={run.guardrails} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
