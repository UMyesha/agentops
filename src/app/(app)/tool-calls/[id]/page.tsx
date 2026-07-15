import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, AlertTriangle, Wrench } from "lucide-react";
import { getSessionUserId } from "@/lib/queries/_common";
import { getToolCallById } from "@/lib/queries/toolCalls";
import { StatusBadge } from "@/components/trace/StatusBadge";
import { LatencyDisplay } from "@/components/trace/LatencyDisplay";
import { JsonViewer } from "@/components/trace/JsonViewer";
import { Card, CardContent } from "@/components/ui/card";

function fmtDateTime(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

export default async function ToolCallDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const tc = await getToolCallById(id, userId);
  if (!tc) notFound();

  const isError = tc.status === "ERROR";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/runs" className="hover:text-foreground">
          Runs
        </Link>
        <ChevronRight className="size-3.5" />
        <Link href={`/runs/${tc.run.id}`} className="hover:text-foreground">
          {tc.run.workflow.name}
        </Link>
        <ChevronRight className="size-3.5" />
        <span>
          Step {tc.step.order} · {tc.step.agent.name}
        </span>
        <ChevronRight className="size-3.5" />
        <span className="font-mono text-foreground">{tc.toolName}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Wrench className="size-5 text-muted-foreground" />
        <h1 className="font-mono text-xl font-semibold">{tc.toolName}</h1>
        <StatusBadge status={tc.status} />
      </div>

      {/* Metadata */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Latency
            </p>
            <LatencyDisplay ms={tc.latencyMs} className="mt-1" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Started
            </p>
            <p className="mt-1 font-mono text-sm">{fmtDateTime(tc.startedAt)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Completed
            </p>
            <p className="mt-1 font-mono text-sm">
              {fmtDateTime(tc.completedAt)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {isError && tc.error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Tool call failed</p>
            <p className="mt-0.5 font-mono text-xs">{tc.error}</p>
          </div>
        </div>
      )}

      {/* Input / Output */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1.5 text-sm font-medium">Input</p>
          <JsonViewer data={tc.input} />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Output</p>
          <JsonViewer data={tc.output} />
        </div>
      </div>
    </div>
  );
}
