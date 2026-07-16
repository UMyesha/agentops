import type { ToolContext } from "@/types";
import { ToolError } from "@/tools/errors";

// Pure implementations over the seeded MockRepo fixture. No DB access and no
// logging here — runTool() owns persistence.

export function listRepoFiles(_input: unknown, ctx: ToolContext) {
  return { files: ctx.repo.files.map((f) => f.path) };
}

export function readFile(input: { path: string }, ctx: ToolContext) {
  const file = ctx.repo.files.find((f) => f.path === input.path);
  if (!file) {
    throw new ToolError(
      "readFile",
      "execution",
      `ENOENT: file not found in repository: ${input.path}`
    );
  }
  return { path: file.path, content: file.content };
}

export function searchFiles(input: { query: string }, ctx: ToolContext) {
  const q = input.query.toLowerCase();
  const matches = ctx.repo.files
    .filter((f) => f.content.toLowerCase().includes(q))
    .map((f) => {
      const idx = f.content.toLowerCase().indexOf(q);
      const start = Math.max(0, idx - 40);
      return {
        path: f.path,
        snippet: f.content.slice(start, idx + q.length + 40).trim(),
      };
    });
  return { matches };
}

export function getPackageJson(_input: unknown, ctx: ToolContext) {
  const pkg = ctx.repo.files.find((f) => f.path === "package.json");
  if (!pkg) {
    throw new ToolError(
      "getPackageJson",
      "execution",
      "package.json not found in repository"
    );
  }
  try {
    return JSON.parse(pkg.content) as Record<string, unknown>;
  } catch {
    throw new ToolError(
      "getPackageJson",
      "execution",
      "package.json is not valid JSON"
    );
  }
}
