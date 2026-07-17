import { describe, it, expect } from "vitest";
import { MockAgentProvider } from "@/agents/providers/mock";
import { PIPELINE, type RunState } from "@/agents/definitions";
import { TOOLS } from "@/tools/registry";
import { MOCK_REPO } from "@/agents/definitions/mock-repo";
import type { AgentContext } from "@/agents/provider";
import type { ToolName } from "@/types";

/**
 * The provider contract: for every role, given DB-style instructions, a
 * structured input, and a working callTool, the provider must return output
 * that satisfies that role's Zod outputSchema.
 *
 * callTool here executes the real tool implementations (no DB) so the contract
 * is exercised against genuine tool results rather than hand-waved fixtures.
 */
function makeCallTool(allowed: readonly ToolName[]) {
  return async (name: string, input: unknown) => {
    if (!allowed.includes(name as ToolName)) {
      throw new Error(`tool ${name} not allowed`);
    }
    const tool = TOOLS[name as ToolName];
    return tool.run(tool.inputSchema.parse(input), { repo: MOCK_REPO });
  };
}

/** Type-safe equivalent of the runner's assignState. */
function assign(state: RunState, role: string, value: unknown) {
  switch (role) {
    case "PLANNER":
      state.planner = value as RunState["planner"];
      break;
    case "CODE_SEARCH":
      state.codeSearch = value as RunState["codeSearch"];
      break;
    case "DOCUMENTATION":
      state.documentation = value as RunState["documentation"];
      break;
    case "VALIDATOR":
      state.validator = value as RunState["validator"];
      break;
    case "EVALUATOR":
      state.evaluator = value as RunState["evaluator"];
      break;
  }
}

function contextFor(
  def: (typeof PIPELINE)[number],
  state: RunState
): AgentContext {
  return {
    role: def.role,
    instructions: `You are the ${def.role} agent. Follow the contract.`,
    promptVersion: 2,
    model: "mock",
    input: def.buildInput(state),
    repo: MOCK_REPO,
    tools: def.tools,
    callTool: makeCallTool(def.tools),
  };
}

describe("AgentProvider contract — MockAgentProvider", () => {
  it("every role returns output satisfying its schema, end to end", async () => {
    const provider = new MockAgentProvider();
    const state: RunState = {
      request: "Generate onboarding documentation for a new developer.",
      repo: MOCK_REPO,
    };

    for (const def of PIPELINE) {
      const result = await provider.run(contextFor(def, state));

      const parsed = def.outputSchema.safeParse(result.output);
      expect(
        parsed.success,
        `${def.role} output failed its schema: ${
          parsed.success ? "" : JSON.stringify(parsed.error.issues)
        }`
      ).toBe(true);

      expect(result.estTokens).toBeGreaterThan(0);

      // Feed the validated output forward, exactly as the runner does.
      if (parsed.success) assign(state, def.role, parsed.data);
    }
  });

  it("is deterministic — identical inputs produce identical outputs", async () => {
    const provider = new MockAgentProvider();
    const state: RunState = { request: "Onboard me.", repo: MOCK_REPO };
    const def = PIPELINE[0];

    const a = await provider.run(contextFor(def, state));
    const b = await provider.run(contextFor(def, state));
    expect(a.output).toEqual(b.output);
    expect(a.estTokens).toBe(b.estTokens);
  });

  it("the evaluator's output carries everything EvaluationResult needs", async () => {
    const provider = new MockAgentProvider();
    const state: RunState = { request: "Onboard me.", repo: MOCK_REPO };

    // Advance to the evaluator.
    for (const def of PIPELINE) {
      const result = await provider.run(contextFor(def, state));
      assign(state, def.role, def.outputSchema.parse(result.output));
    }

    const evaluation = state.evaluator!;
    expect(typeof evaluation.score).toBe("number");
    expect(["PASS", "FAIL"]).toContain(evaluation.result);
    expect(evaluation.feedback.length).toBeGreaterThan(0); // NOT NULL column
    expect(evaluation.rubric.length).toBe(8);
    for (const c of evaluation.rubric) expect(c.id).toBeTruthy();
  });

  it("the planner plans a nonexistent file when asked to simulate failure", async () => {
    const provider = new MockAgentProvider();
    const state: RunState = {
      request: "Please simulate failure for this run.",
      repo: MOCK_REPO,
    };
    const result = await provider.run(contextFor(PIPELINE[0], state));
    const { plan } = PIPELINE[0].outputSchema.parse(result.output) as {
      plan: string[];
    };
    expect(plan.some((p) => p.includes("src/routes/projects.ts"))).toBe(true);
  });
});
