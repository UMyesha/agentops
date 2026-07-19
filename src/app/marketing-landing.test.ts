import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// next/link needs a router context it won't have in a node render; stub it to a
// plain anchor so the static markup renders.
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { href }, children),
}));

const { default: LandingPage } = await import("@/app/(marketing)/page");

const html = renderToStaticMarkup(React.createElement(LandingPage));

describe("marketing landing page", () => {
  it("renders the key sections", () => {
    for (const heading of [
      "Core capabilities",
      "Execution lifecycle",
      "Architecture",
      "Repository Onboarding",
      "Honest limitations",
    ]) {
      expect(html).toContain(heading);
    }
  });

  it("uses neutral CTAs pointing at /login", () => {
    expect(html).toContain("Sign in");
    expect(html).toContain("Explore the demo");
    expect(html).toContain('href="/login"');
  });

  it("uses the approved at-least-once delivery copy", () => {
    expect(html).toContain(
      "BullMQ provides at-least-once delivery, with database claims and idempotency safeguards that reduce duplicate execution."
    );
  });

  it("contains none of the banned marketing claims", () => {
    const lower = html.toLowerCase();
    expect(lower).not.toContain("enterprise-grade");
    expect(lower).not.toContain("production-ready");
    expect(lower).not.toContain("exactly-once");
  });
});
