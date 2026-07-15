import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { getSessionUserId } from "@/lib/queries/_common";
import { listGuardrails } from "@/lib/queries/guardrails";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";

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

export default async function GuardrailsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const view = await listGuardrails(userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Guardrails</h1>
        <p className="text-sm text-muted-foreground">
          Validation failures and safety checks across your runs.
        </p>
      </div>

      {view.total === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <ShieldCheck className="mx-auto mb-2 size-6 text-success" />
          <p className="text-sm text-muted-foreground">
            No guardrail violations. 🎉
          </p>
        </div>
      ) : (
        <>
          {/* Counts by type */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {view.byType.map((t) => (
              <Card key={t.type}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert
                      className={
                        SEVERE.has(t.type)
                          ? "size-4 text-destructive"
                          : "size-4 text-warning"
                      }
                    />
                    <span className="text-sm font-medium">
                      {label(t.type)}
                    </span>
                  </div>
                  <span className="text-lg font-semibold tabular-nums">
                    {t.count}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent violations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent violations</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {view.recent.map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/runs/${v.runId}`}
                      className="flex items-start gap-3 px-5 py-3 hover:bg-muted/50"
                    >
                      <ShieldAlert
                        className={
                          SEVERE.has(v.type)
                            ? "mt-0.5 size-4 shrink-0 text-destructive"
                            : "mt-0.5 size-4 shrink-0 text-warning"
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              SEVERE.has(v.type) ? "destructive" : "warning"
                            }
                          >
                            {label(v.type)}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {v.workflowName}
                          </span>
                          {v.stepId && (
                            <span className="font-mono text-xs text-muted-foreground">
                              step {v.stepId.slice(0, 8)}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm">{v.message}</p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {timeAgo(v.createdAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
