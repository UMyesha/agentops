import { FileText } from "lucide-react";
import { JsonViewer } from "@/components/trace/JsonViewer";
import type { OnboardingDoc } from "@/types";

function isOnboardingDoc(v: unknown): v is OnboardingDoc {
  return (
    typeof v === "object" &&
    v !== null &&
    "projectOverview" in v &&
    "setupInstructions" in v &&
    "keyFiles" in v
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold">{title}</h4>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export function FinalOutputViewer({ output }: { output: unknown }) {
  if (output == null) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <FileText className="mx-auto mb-2 size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          This run produced no final output.
        </p>
      </div>
    );
  }

  // Structured onboarding doc → render human-readable sections.
  if (isOnboardingDoc(output)) {
    return (
      <div className="space-y-5 rounded-lg border bg-card p-5">
        <Section title="Project Overview" body={output.projectOverview} />
        <Section title="Setup Instructions" body={output.setupInstructions} />
        <Section title="Folder Structure" body={output.folderStructure} />
        <div>
          <h4 className="mb-2 text-sm font-semibold">Key Files</h4>
          <ul className="space-y-2">
            {output.keyFiles.map((f) => (
              <li key={f.path} className="rounded-md border bg-muted/30 p-3">
                <code className="text-xs font-medium text-sky-700 dark:text-sky-300">
                  {f.path}
                </code>
                <p className="mt-1 text-sm text-muted-foreground">
                  {f.explanation}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <Section
          title="Development Workflow"
          body={output.developmentWorkflow}
        />
      </div>
    );
  }

  // Fallback: raw JSON.
  return <JsonViewer data={output} />;
}
