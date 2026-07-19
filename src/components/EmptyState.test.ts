import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Activity } from "lucide-react";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));

const { EmptyState } = await import("@/components/EmptyState");

describe("EmptyState", () => {
  it("renders title and description", () => {
    const html = renderToStaticMarkup(
      React.createElement(EmptyState, {
        icon: Activity,
        title: "No runs yet",
        description: "Run a workflow to see it here.",
      })
    );
    expect(html).toContain("No runs yet");
    expect(html).toContain("Run a workflow to see it here.");
  });

  it("renders an action link when provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(EmptyState, {
        title: "Empty",
        action: { label: "Go to projects", href: "/projects" },
      })
    );
    expect(html).toContain("Go to projects");
    expect(html).toContain('href="/projects"');
  });

  it("omits the action when not provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(EmptyState, { title: "Empty" })
    );
    expect(html).not.toContain("<a");
  });
});
