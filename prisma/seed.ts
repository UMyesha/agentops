import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { MOCK_REPO } from "../src/agents/definitions/mock-repo";
import { SEEDED_ONBOARDING_DOC } from "./fixtures/onboarding-output";

const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a run start time relative to now, so seeded data looks recent. */
function minutesAgo(mins: number): Date {
  return new Date(Date.now() - mins * 60_000);
}

const json = (v: unknown) => v as Prisma.InputJsonValue;

// ─── Tool + agent definitions (mirrors src/tools + src/agents) ───────────────

const TOOLS = [
  {
    name: "listRepoFiles",
    description: "List all file paths in the target repository.",
    inputSchema: { type: "object", properties: {}, required: [] },
    outputSchema: {
      type: "object",
      properties: { files: { type: "array", items: { type: "string" } } },
    },
  },
  {
    name: "readFile",
    description: "Read the full contents of a single file by path.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
    outputSchema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
    },
  },
  {
    name: "searchFiles",
    description: "Search file contents for a query string; returns matching paths and snippets.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
    outputSchema: {
      type: "object",
      properties: { matches: { type: "array" } },
    },
  },
  {
    name: "getPackageJson",
    description: "Return the parsed package.json of the repository.",
    inputSchema: { type: "object", properties: {}, required: [] },
    outputSchema: { type: "object" },
  },
  {
    name: "validateOutput",
    description: "Validate the onboarding document contains all required sections.",
    inputSchema: {
      type: "object",
      properties: { document: { type: "object" } },
      required: ["document"],
    },
    outputSchema: {
      type: "object",
      properties: {
        valid: { type: "boolean" },
        missingSections: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "scoreOutput",
    description: "Score the onboarding document against the evaluation rubric.",
    inputSchema: {
      type: "object",
      properties: { document: { type: "object" } },
      required: ["document"],
    },
    outputSchema: {
      type: "object",
      properties: { score: { type: "number" }, rubric: { type: "array" } },
    },
  },
] as const;

type SeedAgent = {
  role: "PLANNER" | "CODE_SEARCH" | "DOCUMENTATION" | "VALIDATOR" | "EVALUATOR";
  name: string;
  description: string;
  order: number;
  prompt: string;
};

const AGENTS: SeedAgent[] = [
  {
    role: "PLANNER",
    name: "Planner Agent",
    description: "Breaks the onboarding request into an ordered plan of information to gather.",
    order: 1,
    prompt:
      "You are the Planner. Given a request to onboard a new developer to a repository, produce an ordered plan of the information that must be gathered (file inventory, dependencies, entry points, key modules) before documentation can be written. Return a JSON array of steps.",
  },
  {
    role: "CODE_SEARCH",
    name: "Code Search Agent",
    description: "Uses repo tools to inspect files and gather relevant context.",
    order: 2,
    prompt:
      "You are the Code Search agent. Use the available tools (listRepoFiles, getPackageJson, readFile, searchFiles) to gather the context the plan requires. Return the collected file contents and findings.",
  },
  {
    role: "DOCUMENTATION",
    name: "Documentation Agent",
    description: "Generates the final onboarding documentation from gathered context.",
    order: 3,
    prompt:
      "You are the Documentation agent. Using ONLY the gathered repo context, produce an onboarding document with these sections: projectOverview, setupInstructions, folderStructure, keyFiles, developmentWorkflow. Do not invent facts not supported by the context.",
  },
  {
    role: "VALIDATOR",
    name: "Validator Agent",
    description: "Checks the output contains all required sections and is well-formed.",
    order: 4,
    prompt:
      "You are the Validator. Call validateOutput on the document and flag any missing or malformed sections. Return a structured validation report.",
  },
  {
    role: "EVALUATOR",
    name: "Evaluator Agent",
    description: "Scores the final output against the onboarding rubric.",
    order: 5,
    prompt:
      "You are the Evaluator. Call scoreOutput to grade the onboarding document against the 8-criterion rubric. Return a score (0-100), pass/fail, and feedback.",
  },
];

// The rubric breakdown stored on the seeded completed run's EvaluationResult.
const PASSING_RUBRIC = [
  { id: "overview", label: "Project overview included", weight: 15, passed: true },
  { id: "setup", label: "Setup instructions included", weight: 15, passed: true },
  { id: "structure", label: "Folder structure included", weight: 12, passed: true },
  { id: "key-files", label: "Key files explained", weight: 15, passed: true },
  { id: "dev-workflow", label: "Development workflow explained", weight: 12, passed: true },
  { id: "clarity", label: "Output is clear", weight: 11, passed: true },
  {
    id: "grounded",
    label: "Output avoids unsupported claims",
    weight: 10,
    passed: true,
  },
  {
    id: "specific",
    label: "Output is specific to the provided repo context",
    weight: 10,
    passed: false,
    note: "Development workflow section is slightly generic; could reference the Vitest config directly.",
  },
];

async function main() {
  console.log("🌱 Seeding AgentOps demo data…");

  // ─── Reset (idempotent seed) ───────────────────────────────────────────────
  // Order matters due to FK constraints; deleting runs cascades to children.
  await prisma.auditLog.deleteMany();
  await prisma.evaluationResult.deleteMany();
  await prisma.guardrailViolation.deleteMany();
  await prisma.toolCall.deleteMany();
  await prisma.runStep.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.promptVersion.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.project.deleteMany();
  await prisma.tool.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  // ─── Demo user ─────────────────────────────────────────────────────────────
  const email = process.env.DEMO_USER_EMAIL ?? "demo@agentops.dev";
  const password = process.env.DEMO_USER_PASSWORD ?? "demo1234";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name: "Demo Engineer",
      passwordHash,
    },
  });
  console.log(`  ✓ user: ${email} / ${password}`);

  // ─── Tools (global registry) ──────────────────────────────────────────────
  await prisma.tool.createMany({
    data: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: json(t.inputSchema),
      outputSchema: json(t.outputSchema),
    })),
  });
  console.log(`  ✓ ${TOOLS.length} tools`);

  // ─── Project + workflow ────────────────────────────────────────────────────
  const project = await prisma.project.create({
    data: {
      name: "TaskFlow Onboarding",
      slug: "taskflow-onboarding",
      description:
        "Demo workspace that onboards new developers to the TaskFlow API repository using a multi-agent workflow.",
      ownerId: user.id,
    },
  });

  const workflow = await prisma.workflow.create({
    data: {
      projectId: project.id,
      name: "Repository Onboarding",
      description:
        "Inspects a repository with a team of agents and produces onboarding documentation for a new developer.",
      definition: json({
        repo: MOCK_REPO.name,
        pipeline: AGENTS.map((a) => ({ role: a.role, order: a.order })),
        tools: TOOLS.map((t) => t.name),
      }),
    },
  });
  console.log(`  ✓ project + workflow`);

  // ─── Agents + prompt versions ──────────────────────────────────────────────
  const agentByRole: Record<string, { id: string }> = {};
  for (const a of AGENTS) {
    const agent = await prisma.agent.create({
      data: {
        workflowId: workflow.id,
        role: a.role,
        name: a.name,
        description: a.description,
        order: a.order,
        model: "mock",
        promptVersions: {
          create: [
            {
              version: 1,
              content: a.prompt,
              notes: "Initial prompt.",
              isActive: false,
            },
            {
              version: 2,
              content: a.prompt + "\n\nAlways ground claims in retrieved file context.",
              notes: "Added grounding instruction to reduce unsupported claims.",
              isActive: true,
            },
          ],
        },
      },
    });
    agentByRole[a.role] = agent;
  }
  console.log(`  ✓ ${AGENTS.length} agents (with prompt versions)`);

  const promptSnapshot = json(
    AGENTS.map((a) => ({ role: a.role, promptVersion: 2 }))
  );

  const runInput = json({
    request: "Generate onboarding documentation for a new developer joining the TaskFlow API repo.",
    repo: MOCK_REPO.name,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN 1 — COMPLETED (a clean, passing trace)
  // ═══════════════════════════════════════════════════════════════════════════
  const start1 = minutesAgo(42);
  const completedRun = await prisma.agentRun.create({
    data: {
      workflowId: workflow.id,
      projectId: project.id,
      triggeredById: user.id,
      status: "COMPLETED",
      input: runInput,
      finalOutput: json(SEEDED_ONBOARDING_DOC),
      totalLatencyMs: 8420,
      estTokens: 6180,
      estCostUsd: 0.0092,
      model: "mock",
      retryCount: 0,
      promptVersionSnapshot: promptSnapshot,
      startedAt: start1,
      completedAt: new Date(start1.getTime() + 8420),
      createdAt: start1,
    },
  });

  // Step timings accumulate across the run.
  let cursor = start1.getTime();
  const step = async (
    role: SeedAgent["role"],
    order: number,
    latencyMs: number,
    input: unknown,
    output: unknown,
    estTokens: number
  ) => {
    const startedAt = new Date(cursor);
    cursor += latencyMs;
    const completedAt = new Date(cursor);
    return prisma.runStep.create({
      data: {
        runId: completedRun.id,
        agentId: agentByRole[role].id,
        role,
        order,
        status: "COMPLETED",
        input: json(input),
        output: json(output),
        latencyMs,
        estTokens,
        startedAt,
        completedAt,
      },
    });
  };

  const plannerStep = await step(
    "PLANNER",
    1,
    640,
    { request: "Onboard a new developer to TaskFlow API" },
    {
      plan: [
        "List all repository files",
        "Read package.json for stack + scripts",
        "Read entry point and route handlers",
        "Search for auth + middleware patterns",
        "Draft onboarding document",
      ],
    },
    420
  );

  const searchStep = await step(
    "CODE_SEARCH",
    2,
    3120,
    { plan: "gather repo context" },
    {
      gathered: [
        "package.json",
        "src/index.ts",
        "src/routes/auth.ts",
        "src/middleware/auth.ts",
      ],
      findings: "Express + Prisma + JWT auth stack; entry point mounts /auth and /tasks.",
    },
    3260
  );

  const docStep = await step(
    "DOCUMENTATION",
    3,
    3380,
    { context: "gathered repo files" },
    SEEDED_ONBOARDING_DOC,
    2010
  );

  const validatorStep = await step(
    "VALIDATOR",
    4,
    780,
    { document: "onboarding doc" },
    { valid: true, missingSections: [] },
    280
  );

  const evaluatorStep = await step(
    "EVALUATOR",
    5,
    500,
    { document: "onboarding doc" },
    { score: 90, result: "PASS" },
    210
  );

  // Tool calls for the completed run (attached to the Code Search + later steps).
  const toolCall = async (
    stepId: string,
    toolName: string,
    startOffsetMs: number,
    latencyMs: number,
    input: unknown,
    output: unknown,
    status: "SUCCESS" | "ERROR" = "SUCCESS",
    error?: string
  ) => {
    const startedAt = new Date(searchStep.startedAt!.getTime() + startOffsetMs);
    return prisma.toolCall.create({
      data: {
        runId: completedRun.id,
        stepId,
        toolName,
        status,
        input: json(input),
        output: output === undefined ? Prisma.JsonNull : json(output),
        error,
        latencyMs,
        startedAt,
        completedAt: new Date(startedAt.getTime() + latencyMs),
      },
    });
  };

  const pkg = JSON.parse(MOCK_REPO.files.find((f) => f.path === "package.json")!.content);
  await toolCall(searchStep.id, "listRepoFiles", 40, 120, {}, {
    files: MOCK_REPO.files.map((f) => f.path),
  });
  await toolCall(searchStep.id, "getPackageJson", 200, 90, {}, pkg);
  await toolCall(
    searchStep.id,
    "readFile",
    360,
    140,
    { path: "src/index.ts" },
    { path: "src/index.ts", content: MOCK_REPO.files.find((f) => f.path === "src/index.ts")!.content }
  );
  await toolCall(
    searchStep.id,
    "readFile",
    560,
    150,
    { path: "src/routes/auth.ts" },
    {
      path: "src/routes/auth.ts",
      content: MOCK_REPO.files.find((f) => f.path === "src/routes/auth.ts")!.content,
    }
  );
  await toolCall(
    searchStep.id,
    "searchFiles",
    780,
    210,
    { query: "requireAuth" },
    { matches: [{ path: "src/middleware/auth.ts", snippet: "export function requireAuth(" }] }
  );
  await toolCall(
    validatorStep.id,
    "validateOutput",
    3900,
    80,
    { document: "onboarding doc" },
    { valid: true, missingSections: [] }
  );
  await toolCall(
    evaluatorStep.id,
    "scoreOutput",
    4200,
    120,
    { document: "onboarding doc" },
    { score: 90, rubric: PASSING_RUBRIC }
  );

  // Evaluation result for the completed run.
  await prisma.evaluationResult.create({
    data: {
      runId: completedRun.id,
      score: 90,
      result: "PASS",
      rubric: json(PASSING_RUBRIC),
      feedback:
        "Strong onboarding doc: accurate stack summary, correct setup steps, and specific key-file explanations. Minor deduction — the development-workflow section is slightly generic and could cite the Vitest setup directly.",
    },
  });

  // One low-severity guardrail note on the otherwise-clean run.
  await prisma.guardrailViolation.create({
    data: {
      runId: completedRun.id,
      stepId: docStep.id,
      type: "UNSUPPORTED_CLAIM",
      message:
        "Development workflow mentions 'open a PR' conventions not directly evidenced in the repo files.",
      details: json({ severity: "low", section: "developmentWorkflow" }),
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "run.completed",
      entity: "AgentRun",
      entityId: completedRun.id,
      metadata: json({ score: 90, latencyMs: 8420 }),
    },
  });
  console.log(`  ✓ completed run (score 90)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // RUN 2 — FAILED (tool failure during documentation → downstream skipped)
  // ═══════════════════════════════════════════════════════════════════════════
  const start2 = minutesAgo(15);
  const failedRun = await prisma.agentRun.create({
    data: {
      workflowId: workflow.id,
      projectId: project.id,
      triggeredById: user.id,
      status: "FAILED",
      input: runInput,
      finalOutput: Prisma.JsonNull,
      totalLatencyMs: 4110,
      estTokens: 3020,
      estCostUsd: 0.0044,
      model: "mock",
      failureReason: "readFile tool failed: file not found (src/routes/projects.ts)",
      retryCount: 0,
      promptVersionSnapshot: promptSnapshot,
      startedAt: start2,
      completedAt: new Date(start2.getTime() + 4110),
      createdAt: start2,
    },
  });

  let c2 = start2.getTime();
  const failStep = async (
    role: SeedAgent["role"],
    order: number,
    status: "COMPLETED" | "FAILED" | "SKIPPED",
    latencyMs: number,
    input: unknown,
    output: unknown,
    error?: string
  ) => {
    const startedAt = status === "SKIPPED" ? null : new Date(c2);
    if (status !== "SKIPPED") c2 += latencyMs;
    const completedAt = status === "SKIPPED" ? null : new Date(c2);
    return prisma.runStep.create({
      data: {
        runId: failedRun.id,
        agentId: agentByRole[role].id,
        role,
        order,
        status,
        input: json(input),
        output: output === undefined ? Prisma.JsonNull : json(output),
        latencyMs: status === "SKIPPED" ? null : latencyMs,
        error,
        startedAt,
        completedAt,
      },
    });
  };

  const fPlanner = await failStep(
    "PLANNER",
    1,
    "COMPLETED",
    610,
    { request: "Onboard a new developer to TaskFlow API" },
    { plan: ["List files", "Read routes including src/routes/projects.ts", "Draft doc"] }
  );

  const fSearch = await failStep(
    "CODE_SEARCH",
    2,
    "FAILED",
    3500,
    { plan: "gather repo context" },
    undefined,
    "readFile('src/routes/projects.ts') → file not found. The planner referenced a route file that does not exist in this repo."
  );

  const fDoc = await failStep("DOCUMENTATION", 3, "SKIPPED", 0, { context: "n/a" }, undefined);
  const fVal = await failStep("VALIDATOR", 4, "SKIPPED", 0, { document: "n/a" }, undefined);
  const fEval = await failStep("EVALUATOR", 5, "SKIPPED", 0, { document: "n/a" }, undefined);

  // Tool calls for the failed run — one succeeds, one errors.
  await prisma.toolCall.create({
    data: {
      runId: failedRun.id,
      stepId: fSearch.id,
      toolName: "listRepoFiles",
      status: "SUCCESS",
      input: json({}),
      output: json({ files: MOCK_REPO.files.map((f) => f.path) }),
      latencyMs: 110,
      startedAt: new Date(fSearch.startedAt!.getTime() + 30),
      completedAt: new Date(fSearch.startedAt!.getTime() + 140),
    },
  });
  await prisma.toolCall.create({
    data: {
      runId: failedRun.id,
      stepId: fSearch.id,
      toolName: "readFile",
      status: "ERROR",
      input: json({ path: "src/routes/projects.ts" }),
      output: Prisma.JsonNull,
      error: "ENOENT: file not found in repository: src/routes/projects.ts",
      latencyMs: 60,
      startedAt: new Date(fSearch.startedAt!.getTime() + 400),
      completedAt: new Date(fSearch.startedAt!.getTime() + 460),
    },
  });

  // Guardrail violations for the failed run.
  await prisma.guardrailViolation.createMany({
    data: [
      {
        runId: failedRun.id,
        stepId: fSearch.id,
        type: "TOOL_FAILURE",
        message: "readFile failed: src/routes/projects.ts not found.",
        details: json({ tool: "readFile", path: "src/routes/projects.ts" }),
      },
      {
        runId: failedRun.id,
        stepId: fDoc.id,
        type: "SKIPPED_STEP",
        message: "Documentation step skipped because context gathering failed.",
        details: json({ skipped: ["DOCUMENTATION", "VALIDATOR", "EVALUATOR"] }),
      },
      {
        runId: failedRun.id,
        stepId: null,
        type: "EMPTY_OUTPUT",
        message: "Run produced no final output.",
        details: json({ reason: "pipeline aborted at CODE_SEARCH" }),
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "run.failed",
      entity: "AgentRun",
      entityId: failedRun.id,
      metadata: json({ failureReason: "tool failure", step: "CODE_SEARCH" }),
    },
  });
  console.log(`  ✓ failed run (tool failure at CODE_SEARCH)`);

  // Reference the otherwise-unused skipped step vars to keep the intent explicit.
  void fPlanner;
  void fVal;
  void fEval;
  void plannerStep;
  void docStep;

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
