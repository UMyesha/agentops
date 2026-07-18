import type { AgentContext, AgentProvider, AgentResult } from "@/agents/provider";
import type { MockRepo, OnboardingDoc } from "@/types";
import { estimateTokens } from "@/lib/metrics";
import { RetryableRunError } from "@/agents/errors";
import { retryTriggersEnabled } from "@/queue/config";

// Synthetic retryable-failure phrases (test-only). They throw a
// RetryableRunError from the Planner step, but ONLY when the gate is on
// (AI_PROVIDER=mock AND AGENTOPS_ENABLE_RETRY_TEST_TRIGGERS=true). Otherwise
// they are inert plain text. Distinct from the ungated "simulate failure"
// business failure (a deterministic tool failure handled elsewhere).
const TRANSIENT_ALWAYS = "simulate transient failure always";
const TRANSIENT_ONCE = "simulate transient failure once";

function maybeThrowSyntheticTransient(ctx: AgentContext) {
  if (ctx.role !== "PLANNER") return; // fail deterministically at the first step
  if (!retryTriggersEnabled()) return; // gated off → inert
  const req = String(
    (ctx.input as { request?: string } | null)?.request ?? ""
  ).toLowerCase();
  if (req.includes(TRANSIENT_ALWAYS)) {
    throw new RetryableRunError(
      "Synthetic transient failure (always) [gated test trigger]"
    );
  }
  if (req.includes(TRANSIENT_ONCE) && ctx.attempt < 2) {
    throw new RetryableRunError(
      `Synthetic transient failure (attempt ${ctx.attempt}) [gated test trigger]`
    );
  }
}

/**
 * Deterministic, dependency-free implementation of all five agents.
 *
 * Default provider: no API key, no network, no cost, identical output every
 * run — which is what makes the demo reproducible and the tests meaningful.
 *
 * Failure scenario: if the run request contains "simulate failure", the Planner
 * deliberately plans to read a route file that does not exist. Code Search then
 * attempts it, readFile raises ENOENT, and the run fails exactly the way the
 * seeded failed run did. This gives a real, deterministic failure path to
 * exercise end-to-end without special-casing the runner.
 */
const FAILURE_TRIGGER = "simulate failure";
const MISSING_FILE = "src/routes/projects.ts";

// ─── helpers ─────────────────────────────────────────────────────────────────

/** File paths a plan line asks to read (package.json is fetched separately). */
function extractPaths(plan: string[]): string[] {
  const re = /(?:src|prisma)\/[\w./-]+\.\w+/g;
  const found = new Set<string>();
  for (const line of plan) {
    for (const m of line.match(re) ?? []) found.add(m);
  }
  return [...found];
}

function pkgOf(repo: MockRepo): {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
} {
  const f = repo.files.find((x) => x.path === "package.json");
  if (!f) return {};
  try {
    return JSON.parse(f.content);
  } catch {
    return {};
  }
}

/** Build an onboarding document grounded in the actual repo fixture. */
function buildDoc(repo: MockRepo): OnboardingDoc {
  const pkg = pkgOf(repo);
  const deps = Object.keys(pkg.dependencies ?? {});
  const scripts = pkg.scripts ?? {};
  const paths = repo.files.map((f) => f.path);

  const explanations: Record<string, string> = {
    "src/index.ts":
      "Application entry point. Creates the Express app, mounts the routers, and registers the error handler before listening.",
    "src/routes/auth.ts":
      "Authentication routes. Validates credentials with Zod, hashes passwords with bcrypt, and issues a JWT on login.",
    "src/routes/tasks.ts":
      "Task CRUD routes. Every handler is protected by the auth middleware and scopes queries to the requesting user.",
    "src/middleware/auth.ts":
      "requireAuth middleware. Verifies the Bearer JWT and attaches the user id to the request for downstream handlers.",
    "prisma/schema.prisma":
      "Database schema. Defines the models and their relations, which drive the generated Prisma client.",
  };

  const keyFiles = Object.keys(explanations)
    .filter((p) => paths.includes(p))
    .slice(0, 4)
    .map((path) => ({ path, explanation: explanations[path] }));

  const dirs = [...new Set(paths.map((p) => p.split("/").slice(0, -1).join("/") || "."))];

  return {
    projectOverview: `${repo.name} — ${repo.description} The stack is built on ${deps
      .slice(0, 4)
      .join(", ")}. This document orients a new developer to the codebase: how it is structured, how to run it locally, and which files matter most.`,

    setupInstructions: Object.keys(scripts).length
      ? `1. Install dependencies with \`npm install\`.\n2. Copy \`.env.example\` to \`.env\` and fill in the required values.\n${
          scripts["db:migrate"]
            ? `3. Apply the database schema with \`npm run db:migrate\`.\n`
            : ""
        }4. Start the development server with \`npm run ${
          scripts.dev ? "dev" : "start"
        }\`.${
          scripts.test ? `\n5. Run the test suite with \`npm test\`.` : ""
        }`
      : `Install dependencies with \`npm install\`, copy \`.env.example\` to \`.env\`, then start the app.`,

    folderStructure: dirs
      .sort()
      .map((d) => `${d}/ — ${paths.filter((p) => p.startsWith(d === "." ? "" : d + "/")).length} file(s)`)
      .join("\n"),

    keyFiles,

    developmentWorkflow: `Develop against a local database instance. Use \`npm run ${
      scripts.dev ? "dev" : "start"
    }\` for a hot-reloading server.${
      scripts["db:migrate"]
        ? " Schema changes go through the migrate script rather than manual SQL."
        : ""
    }${scripts.lint ? " Lint with `npm run lint`." : ""}${
      scripts.test ? " Run `npm test` before opening a pull request." : ""
    } Keep route handlers thin and push validation to the schema layer.`,
  };
}

// ─── provider ────────────────────────────────────────────────────────────────

export class MockAgentProvider implements AgentProvider {
  readonly name = "mock" as const;
  readonly model = "mock";

  async run(ctx: AgentContext): Promise<AgentResult> {
    maybeThrowSyntheticTransient(ctx);
    const output = await this.dispatch(ctx);
    return {
      output,
      estTokens:
        estimateTokens(ctx.instructions) +
        estimateTokens(ctx.input) +
        estimateTokens(output),
    };
  }

  private async dispatch(ctx: AgentContext): Promise<unknown> {
    switch (ctx.role) {
      case "PLANNER":
        return this.planner(ctx);
      case "CODE_SEARCH":
        return this.codeSearch(ctx);
      case "DOCUMENTATION":
        return buildDoc(ctx.repo);
      case "VALIDATOR":
        return ctx.callTool("validateOutput", {
          document: (ctx.input as { document: unknown }).document,
        });
      case "EVALUATOR":
        return ctx.callTool("scoreOutput", {
          document: (ctx.input as { document: unknown }).document,
        });
      default:
        throw new Error(`MockAgentProvider: unhandled role ${ctx.role}`);
    }
  }

  private planner(ctx: AgentContext): { plan: string[] } {
    const { request } = ctx.input as { request: string };
    const plan = [
      "List all repository files",
      "Read package.json to identify the stack and scripts",
      "Read src/index.ts to find the entry point",
      "Read src/routes/auth.ts to understand authentication",
      "Search for requireAuth to trace middleware usage",
      "Draft the onboarding document",
    ];
    if (request.toLowerCase().includes(FAILURE_TRIGGER)) {
      // Deliberately reference a file that does not exist in this repo.
      plan.splice(4, 0, `Read ${MISSING_FILE} to document project routes`);
    }
    return { plan };
  }

  private async codeSearch(
    ctx: AgentContext
  ): Promise<{ gathered: string[]; findings: string }> {
    const { plan } = ctx.input as { plan: string[] };

    const listed = (await ctx.callTool("listRepoFiles", {})) as {
      files: string[];
    };
    const pkg = (await ctx.callTool("getPackageJson", {})) as {
      dependencies?: Record<string, string>;
    };

    const gathered: string[] = [];
    // Read every file the plan asked for. A planned path that doesn't exist
    // raises ENOENT here and fails the step — by design.
    for (const path of extractPaths(plan)) {
      const file = (await ctx.callTool("readFile", { path })) as {
        path: string;
      };
      gathered.push(file.path);
    }

    const search = (await ctx.callTool("searchFiles", {
      query: "requireAuth",
    })) as { matches: { path: string }[] };

    const deps = Object.keys(pkg.dependencies ?? {}).slice(0, 4).join(", ");
    return {
      gathered,
      findings: `Inventoried ${listed.files.length} files. Stack: ${deps}. Entry point and route handlers reviewed; requireAuth referenced in ${search.matches.length} file(s).`,
    };
  }
}
