"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Github, Loader2, Info } from "lucide-react";

// Well-known seeded demo credentials. These are NOT secrets — they belong to a
// throwaway demo account and are documented in .env.example / README. They are
// only surfaced when the server says demo mode is on.
const DEMO_EMAIL = "demo@agentops.dev";
const DEMO_PASSWORD = "demo1234";

/**
 * Credentials + GitHub sign-in. Receives a serializable `demoMode` boolean from
 * the (server-only) login page — it never imports `appConfig`. Only when
 * `demoMode` is true are the demo credentials prefilled and hinted; otherwise
 * the fields start blank with no hint.
 */
export function LoginForm({ demoMode = false }: { demoMode?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(demoMode ? DEMO_EMAIL : "");
  const [password, setPassword] = useState(demoMode ? DEMO_PASSWORD : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password. Check your credentials and try again.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleCredentials} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            required
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="size-4 motion-safe:animate-spin" />}
          Sign in
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
      >
        <Github className="size-4" />
        Continue with GitHub
      </Button>

      {demoMode && (
        <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <Info className="size-3.5" />
            Demo mode
          </p>
          <p className="mt-1">
            Credentials are pre-filled — just click <strong>Sign in</strong> to
            explore a seeded workspace with one completed and one failed run.
          </p>
        </div>
      )}
    </div>
  );
}
