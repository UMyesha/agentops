import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { LoginForm } = await import("@/components/auth/LoginForm");

function render(demoMode: boolean): string {
  return renderToStaticMarkup(React.createElement(LoginForm, { demoMode }));
}

describe("LoginForm demo-mode gating", () => {
  it("prefills demo credentials and shows the hint when demo mode is on", () => {
    const html = render(true);
    expect(html).toContain("demo@agentops.dev");
    expect(html).toContain("Demo mode");
  });

  it("hides credentials and the hint when demo mode is off", () => {
    const html = render(false);
    expect(html).not.toContain("demo@agentops.dev");
    expect(html).not.toContain("demo1234");
    expect(html).not.toContain("Demo mode");
  });

  it("always offers both sign-in methods", () => {
    const html = render(false);
    expect(html).toContain("Sign in");
    expect(html).toContain("Continue with GitHub");
  });
});
