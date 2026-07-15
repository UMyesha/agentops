import { Skeleton } from "@/components/ui/skeleton";

/**
 * Generic page loading skeleton: a header, an optional metric-card row, and a
 * stack of list rows. Shared by every route's loading.tsx so loading states
 * stay visually consistent.
 */
export function PageSkeleton({
  cards = 0,
  rows = 5,
}: {
  cards?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {cards > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: cards }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-lg border p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
