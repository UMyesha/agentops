import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <FileQuestion className="mb-4 size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        The page or resource you&apos;re looking for doesn&apos;t exist or you
        don&apos;t have access to it.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
