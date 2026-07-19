import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { demoModeEnabled } from "@/lib/appConfig";
import { Workflow } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";

// Read demo mode at REQUEST time (not build time) so toggling the flag takes
// effect without a rebuild, and the marketing landing page can stay static.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const demoMode = demoModeEnabled();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Workflow className="size-6" />
          </div>
          <CardTitle className="text-xl">Sign in to AgentOps</CardTitle>
          <CardDescription>
            AI agent observability, debugging & evals.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm demoMode={demoMode} />
        </CardContent>
      </Card>
    </div>
  );
}
