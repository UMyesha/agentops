import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/trace/StatusBadge";
import { formatLatency, timeAgo } from "@/lib/utils";
import type { RunListItem } from "@/lib/queries/runs";

export function RecentRuns({ runs }: { runs: RunListItem[] }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Recent runs</CardTitle>
        <Link
          href="/runs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          View all <ArrowRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {runs.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <ul className="divide-y">
            {runs.map((run) => (
              <li key={run.id}>
                <Link
                  href={`/runs/${run.id}`}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50"
                >
                  <StatusBadge status={run.status} />
                  <span className="flex-1 truncate text-sm font-medium">
                    {run.workflow.name}
                  </span>
                  <span className="hidden font-mono text-xs tabular-nums text-muted-foreground sm:inline">
                    {run.evaluation ? `${run.evaluation.score}` : "—"}
                  </span>
                  <span className="w-16 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {formatLatency(run.totalLatencyMs)}
                  </span>
                  <span className="w-16 text-right text-xs text-muted-foreground">
                    {timeAgo(run.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
