"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV, BrandIcon, isActive } from "@/components/layout/nav";

/**
 * Accessible mobile navigation. Built on Radix Dialog, which provides focus
 * trapping, Escape-to-close, focus restoration to the trigger, `aria-modal`,
 * a backdrop, and body-scroll lock for free — no hand-rolled slide-over.
 *
 * Rendered only below `md` (the trigger is `md:hidden`); the desktop Sidebar
 * takes over at `md+`.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // Close the drawer whenever the route changes (e.g. after a nav click).
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Open navigation menu"
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <Menu className="size-5" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 motion-safe:animate-in motion-safe:fade-in-0" />
        <Dialog.Content
          aria-modal="true"
          aria-label="Main navigation"
          className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card shadow-lg focus:outline-none motion-safe:animate-in motion-safe:slide-in-from-left"
        >
          <div className="flex h-14 items-center justify-between border-b px-5">
            <div className="flex items-center gap-2">
              <BrandIcon className="size-5 text-primary" />
              <span className="font-semibold tracking-tight">AgentOps</span>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close navigation menu"
                className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <nav className="flex-1 space-y-1 p-3">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
