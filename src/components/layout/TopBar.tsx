import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { MobileNav } from "@/components/layout/MobileNav";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function TopBar({ userEmail }: { userEmail?: string | null }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* Hamburger — visible only below md; opens the accessible Dialog nav. */}
        <MobileNav />
        <Breadcrumb />
      </div>
      <div className="flex items-center gap-3">
        {userEmail && (
          <span className="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline">
            {userEmail}
          </span>
        )}
        {/* Server action sign-out keeps the button a simple form submit. */}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="ghost" size="sm" type="submit">
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </form>
      </div>
    </header>
  );
}
