"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Activity } from "lucide-react";
import { StatusBadge } from "@/components/trace/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { formatCost, formatLatency, timeAgo } from "@/lib/utils";
import type { RunListItem } from "@/lib/queries/runs";

export function RunsTable({ runs }: { runs: RunListItem[] }) {
  const router = useRouter();

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No runs yet"
        description="Run a workflow to see it traced here — every step, tool call, evaluation, and guardrail."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Workflow</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="text-right">Latency</TableHead>
            <TableHead className="text-right">Est. cost</TableHead>
            <TableHead className="text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow
              key={run.id}
              onClick={() => router.push(`/runs/${run.id}`)}
              className="cursor-pointer"
            >
              <TableCell>
                <StatusBadge status={run.status} />
              </TableCell>
              <TableCell className="font-medium">{run.workflow.name}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {run.evaluation ? run.evaluation.score : "—"}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                {formatLatency(run.totalLatencyMs)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                {formatCost(run.estCostUsd)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {timeAgo(run.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
