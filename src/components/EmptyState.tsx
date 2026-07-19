import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared empty-state block: icon + title + description + optional action.
 * Replaces ad-hoc "no data" markup so every list/panel reads consistently and
 * never shows a bare or alarming message.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={
        "flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 px-6 py-10 text-center " +
        (className ?? "")
      }
    >
      {Icon && (
        <div className="mb-3 rounded-full bg-muted p-2.5 text-muted-foreground">
          <Icon className="size-5" />
        </div>
      )}
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
