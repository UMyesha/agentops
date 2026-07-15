import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";
import type { DashboardMetrics } from "@/lib/queries/dashboard";

export function RecentErrors({
  errors,
}: {
  errors: DashboardMetrics["recentErrors"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent errors</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {errors.length === 0 ? (
          <div className="px-6 pb-6 text-sm text-muted-foreground">
            No failed runs. 🎉
          </div>
        ) : (
          <ul className="divide-y">
            {errors.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/runs/${e.id}`}
                  className="flex items-start gap-3 px-6 py-3 hover:bg-muted/50"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {e.failureReason ?? "Run failed"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.workflowName} · {timeAgo(e.createdAt)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
