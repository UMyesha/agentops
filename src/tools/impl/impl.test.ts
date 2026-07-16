import { describe, it, expect } from "vitest";
import { MOCK_REPO } from "@/agents/definitions/mock-repo";
import { ToolError } from "@/tools/errors";
import {
  listRepoFiles,
  readFile,
  searchFiles,
  getPackageJson,
} from "@/tools/impl/repoTools";
import { validateOutput, scoreOutput } from "@/tools/impl/outputTools";
import type { OnboardingDoc } from "@/types";

const ctx = { repo: MOCK_REPO };

const goodDoc: OnboardingDoc = {
  projectOverview:
    "taskflow-api is a TypeScript REST backend for team task management built on express and prisma.",
  setupInstructions:
    "1. Run npm install. 2. Copy .env.example to .env. 3. Run npm run db:migrate. 4. Start with npm run dev.",
  folderStructure: "src/ — application code\nprisma/ — schema and migrations",
  keyFiles: [
    { path: "src/index.ts", explanation: "Entry point that mounts the routers and starts the server." },
    { path: "src/routes/auth.ts", explanation: "Authentication routes issuing JWTs on successful login." },
    { path: "src/middleware/auth.ts", explanation: "Middleware verifying the bearer token on protected routes." },
  ],
  developmentWorkflow:
    "Use npm run dev for hot reload, npm run lint to lint, and npm test before opening a pull request.",
};

describe("repo tools", () => {
  it("listRepoFiles returns every fixture path", () => {
    const out = listRepoFiles({}, ctx);
    expect(out.files).toHaveLength(MOCK_REPO.files.length);
    expect(out.files).toContain("src/index.ts");
  });

  it("readFile returns file content", () => {
    const out = readFile({ path: "src/index.ts" }, ctx);
    expect(out.path).toBe("src/index.ts");
    expect(out.content).toContain("express");
  });

  it("readFile throws ToolError for a missing path", () => {
    expect(() => readFile({ path: "src/routes/projects.ts" }, ctx)).toThrow(ToolError);
    try {
      readFile({ path: "src/routes/projects.ts" }, ctx);
    } catch (e) {
      expect((e as ToolError).message).toMatch(/ENOENT/);
      expect((e as ToolError).kind).toBe("execution");
    }
  });

  it("searchFiles finds matches with snippets", () => {
    const out = searchFiles({ query: "requireAuth" }, ctx);
    expect(out.matches.length).toBeGreaterThan(0);
    expect(out.matches.some((m) => m.path === "src/middleware/auth.ts")).toBe(true);
    expect(out.matches[0].snippet.length).toBeGreaterThan(0);
  });

  it("searchFiles returns no matches for an absent term", () => {
    expect(searchFiles({ query: "zzz-not-present-zzz" }, ctx).matches).toHaveLength(0);
  });

  it("getPackageJson parses the fixture package.json", () => {
    const pkg = getPackageJson({}, ctx) as { name: string; dependencies: object };
    expect(pkg.name).toBe("taskflow-api");
    expect(pkg.dependencies).toHaveProperty("express");
  });
});

describe("validateOutput", () => {
  it("accepts a complete document", () => {
    expect(validateOutput({ document: goodDoc })).toEqual({
      valid: true,
      missingSections: [],
    });
  });

  it("reports missing and empty sections", () => {
    const out = validateOutput({
      document: { ...goodDoc, folderStructure: "", keyFiles: [] },
    });
    expect(out.valid).toBe(false);
    expect(out.missingSections).toContain("folderStructure");
    expect(out.missingSections).toContain("keyFiles");
  });

  it("treats a null document as entirely missing", () => {
    const out = validateOutput({ document: null });
    expect(out.valid).toBe(false);
    expect(out.missingSections).toHaveLength(5);
  });
});

describe("scoreOutput", () => {
  it("scores a good document highly and passes it", () => {
    const out = scoreOutput({ document: goodDoc }, ctx);
    expect(out.score).toBeGreaterThanOrEqual(70);
    expect(out.result).toBe("PASS");
    expect(out.feedback.length).toBeGreaterThan(0);
    expect(out.rubric).toHaveLength(8);
    // Every entry must carry the fields EvaluationPanel renders.
    for (const c of out.rubric) {
      expect(c.id).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(typeof c.passed).toBe("boolean");
      expect(typeof c.weight).toBe("number");
    }
  });

  it("fails a document citing files that do not exist (ungrounded)", () => {
    const out = scoreOutput(
      {
        document: {
          ...goodDoc,
          keyFiles: [
            { path: "src/does/not/exist.ts", explanation: "A file that is not in the repository at all." },
            { path: "src/also/fake.ts", explanation: "Another file that is not in the repository at all." },
            { path: "src/third/fake.ts", explanation: "A third file that is not in the repository at all." },
          ],
        },
      },
      ctx
    );
    expect(out.rubric.find((c) => c.id === "grounded")?.passed).toBe(false);
  });

  it("scores an unparseable document zero and fails it", () => {
    const out = scoreOutput({ document: { nonsense: true } }, ctx);
    expect(out.score).toBe(0);
    expect(out.result).toBe("FAIL");
    expect(out.feedback).toMatch(/did not match/i);
  });

  it("rubric weights sum to 100", () => {
    const out = scoreOutput({ document: goodDoc }, ctx);
    expect(out.rubric.reduce((s, c) => s + c.weight, 0)).toBe(100);
  });
});
