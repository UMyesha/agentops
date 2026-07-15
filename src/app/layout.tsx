import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentOps — AI Agent Observability & Evals",
  description:
    "Run, trace, debug, evaluate, and monitor multi-agent AI workflows. Full trace timelines, MCP-style tool calls, evals, and guardrails.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
