import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function TopBar({ userEmail }: { userEmail?: string | null }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-6">
      <div className="text-sm text-muted-foreground">
        {/* Breadcrumb / page context slot — populated per-page in Phase 2. */}
        Repository Onboarding Platform
      </div>
      <div className="flex items-center gap-3">
        {userEmail && (
          <span className="hidden text-sm text-muted-foreground sm:inline">
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
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
