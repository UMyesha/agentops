import { describe, it, expect } from "vitest";
import * as S from "@/tools/schemas";

describe("tool input schemas", () => {
  it("readFile requires a non-empty path", () => {
    expect(S.readFileInput.safeParse({ path: "src/index.ts" }).success).toBe(true);
    expect(S.readFileInput.safeParse({ path: "" }).success).toBe(false);
    expect(S.readFileInput.safeParse({}).success).toBe(false);
    expect(S.readFileInput.safeParse({ path: 42 }).success).toBe(false);
  });

  it("searchFiles requires a non-empty query", () => {
    expect(S.searchFilesInput.safeParse({ query: "requireAuth" }).success).toBe(true);
    expect(S.searchFilesInput.safeParse({ query: "" }).success).toBe(false);
    expect(S.searchFilesInput.safeParse({}).success).toBe(false);
  });

  it("no-arg tools accept an empty object", () => {
    expect(S.listRepoFilesInput.safeParse({}).success).toBe(true);
    expect(S.getPackageJsonInput.safeParse({}).success).toBe(true);
  });
});

describe("tool output schemas", () => {
  it("listRepoFiles output must be a string array under `files`", () => {
    expect(S.listRepoFilesOutput.safeParse({ files: ["a.ts"] }).success).toBe(true);
    expect(S.listRepoFilesOutput.safeParse({ files: [1] }).success).toBe(false);
    expect(S.listRepoFilesOutput.safeParse({}).success).toBe(false);
  });

  it("validateOutput output requires valid + missingSections", () => {
    expect(
      S.validateOutputOutput.safeParse({ valid: true, missingSections: [] }).success
    ).toBe(true);
    expect(S.validateOutputOutput.safeParse({ valid: true }).success).toBe(false);
  });

  it("scoreOutput output carries everything EvaluationResult needs", () => {
    const good = {
      score: 90,
      result: "PASS",
      rubric: [{ id: "overview", label: "Project overview", weight: 15, passed: true }],
      feedback: "Solid.",
    };
    expect(S.scoreOutputOutput.safeParse(good).success).toBe(true);

    // feedback is a NOT NULL column — an empty string must not slip through.
    expect(S.scoreOutputOutput.safeParse({ ...good, feedback: "" }).success).toBe(false);
    // rubric is required
    expect(S.scoreOutputOutput.safeParse({ ...good, rubric: undefined }).success).toBe(false);
    // score is bounded
    expect(S.scoreOutputOutput.safeParse({ ...good, score: 101 }).success).toBe(false);
    expect(S.scoreOutputOutput.safeParse({ ...good, result: "MAYBE" }).success).toBe(false);
  });

  it("rubric entries require an id (EvaluationPanel keys on it)", () => {
    expect(
      S.rubricSchema.safeParse([{ label: "x", weight: 1, passed: true }]).success
    ).toBe(false);
    expect(
      S.rubricSchema.safeParse([{ id: "", label: "x", weight: 1, passed: true }]).success
    ).toBe(false);
  });
});
