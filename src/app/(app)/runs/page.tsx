import { redirect } from "next/navigation";
import { RunStatus } from "@prisma/client";
import { getSessionUserId } from "@/lib/queries/_common";
import { listRuns } from "@/lib/queries/runs";
import { RunsTable } from "@/components/runs/RunsTable";
import { RunStatusFilter } from "@/components/runs/RunStatusFilter";

const VALID_STATUS = new Set<string>(Object.values(RunStatus));

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { status } = await searchParams;
  const filter =
    status && VALID_STATUS.has(status) ? (status as RunStatus) : undefined;

  const runs = await listRuns(userId, { status: filter });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Runs</h1>
        <p className="text-sm text-muted-foreground">
          All workflow runs, newest first.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <RunStatusFilter />
        <span className="text-sm text-muted-foreground">
          {runs.length} {runs.length === 1 ? "run" : "runs"}
        </span>
      </div>

      <RunsTable runs={runs} />
    </div>
  );
}
