"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for local debugging; a real deployment would ship this
    // to an error tracker here.
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-[60vh] flex-col items-center justify-center text-center"
    >
      <AlertTriangle className="mb-4 size-10 text-destructive" />
      <h1 className="text-xl font-semibold">This page couldn&apos;t load</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Something interrupted loading this page. Your data is safe — retrying
        usually resolves it. If it keeps happening, the app or database may be
        temporarily unavailable.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
      <Button onClick={reset} className="mt-6">
        <RotateCcw className="size-4" />
        Try again
      </Button>
    </div>
  );
}
