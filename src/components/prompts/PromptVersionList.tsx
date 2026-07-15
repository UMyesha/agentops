import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PromptVersion } from "@prisma/client";

function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Prompt versions for a single agent, newest first, active clearly marked. */
export function PromptVersionList({
  versions,
}: {
  versions: PromptVersion[];
}) {
  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No prompt versions.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {versions.map((v) => (
        <li
          key={v.id}
          className={cn(
            "rounded-md border p-3",
            v.isActive && "border-primary/40 bg-primary/5"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold">v{v.version}</span>
            {v.isActive && <Badge variant="success">Active</Badge>}
            <span className="ml-auto text-xs text-muted-foreground">
              {fmtDate(v.createdAt)}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {v.content}
          </p>
          {v.notes && (
            <p className="mt-2 text-xs italic text-muted-foreground">
              Note: {v.notes}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
