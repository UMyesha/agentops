import { Prisma, type RunStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { estimateCost } from "@/lib/metrics";
import { getWorkflowForExecution } from "@/lib/queries/workflows";
import { PIPELINE, type RunState } from "@/agents/definitions";
import { preflightWorkflow } from "@/agents/preflight";
import type { AgentContext, AgentProvider } from "@/agents/provider";
import { runTool } from "@/tools/registry";
import { MOCK_REPO } from "@/agents/definitions/mock-repo";
import type { AgentRoleName, OnboardingDoc } from "@/types";
import type { EvaluatorOutput } from "@/agents/definitions/types";

export class WorkflowNotFoundError extends Error {
  constructor(id: string) {
    super(`Workflow ${id} not found or not accessible.`);
    this.name = "WorkflowNotFoundError";
  }
}

export interface ExecuteRunOptions {
  workflowId: string;
  userId: string;
  request: string;
  /** Injected in tests; otherwise resolved from AI_PROVIDER during preflight. */
  provider?: AgentProvider;
}

export interface ExecuteRunResult {
  runId: string;
  status: Extract<RunStatus, "COMPLETED" | "FAILED">;
}

const json = (v: unknown): Prisma.InputJsonValue =>
  (v === undefined ? null : v) as Prisma.InputJsonValue;

/** Store a step's validated output under the right RunState key. */
function assignState(state: RunState, role: AgentRoleName, output: unknown) {
  switch (role) {
    case "PLANNER":
      state.planner = output as RunState["planner"];
      break;
    case "CODE_SEARCH":
      state.codeSearch = output as RunState["codeSearch"];
      break;
    case "DOCUMENTATION":
      state.documentation = output as OnboardingDoc;
      break;
    case "VALIDATOR":
      state.validator = output as RunState["validator"];
      break;
    case "EVALUATOR":
      state.evaluator = output as EvaluatorOutput;
      break;
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Execute one Repository Onboarding run, synchronously, start to finish.
 *
 * Deliberately NOT wrapped in a Prisma transaction: a mid-pipeline failure must
 * leave the completed portion of the trace on disk. Partial traces are the
 * product here — rolling them back would destroy the thing being debugged.
 */
export async function executeWorkflowRun(
  opts: ExecuteRunOptions
): Promise<ExecuteRunResult> {
  const { workflowId, userId, request } = opts;

  // ── Load + preflight: nothing is written until this passes ────────────────
  const workflow = await getWorkflowForExecution(workflowId, userId);
  if (!workflow) throw new WorkflowNotFoundError(workflowId);

  const dbToolNames = (await db.tool.findMany({ select: { name: true } })).map(
    (t) => t.name
  );
  const { provider, agentsByRole } = preflightWorkflow({
    workflow,
    dbToolNames,
    provider: opts.provider,
  });

  const repo = MOCK_REPO;
  const promptVersionSnapshot = PIPELINE.map((d) => ({
    role: d.role,
    promptVersion: agentsByRole.get(d.role)!.promptVersions[0].version,
  }));

  // ── 1. Create the run (QUEUED) ────────────────────────────────────────────
  const run = await db.agentRun.create({
    data: {
      workflowId: workflow.id,
      projectId: workflow.projectId,
      triggeredById: userId,
      status: "QUEUED",
      input: json({ request, repo: repo.name }),
      model: provider.model,
      retryCount: 0,
      promptVersionSnapshot: json(promptVersionSnapshot),
    },
  });
  await logAudit({
    userId,
    action: "run.created",
    entity: "AgentRun",
    entityId: run.id,
    metadata: { workflowId: workflow.id, provider: provider.name },
  });

  // ── 2. Start it (RUNNING) ─────────────────────────────────────────────────
  const startedAt = new Date();
  await db.agentRun.update({
    where: { id: run.id },
    data: { status: "RUNNING", startedAt },
  });
  await logAudit({
    userId,
    action: "run.started",
    entity: "AgentRun",
    entityId: run.id,
  });

  const state: RunState = { request, repo };
  let totalTokens = 0;

  // ── 3. Execute the pipeline in order ──────────────────────────────────────
  for (let i = 0; i < PIPELINE.length; i++) {
    const def = PIPELINE[i];
    const agent = agentsByRole.get(def.role)!;
    const prompt = agent.promptVersions[0];
    const input = def.buildInput(state);

    const stepStartedAt = new Date();
    const step = await db.runStep.create({
      data: {
        runId: run.id,
        agentId: agent.id,
        role: def.role,
        order: i + 1,
        status: "RUNNING",
        input: json(input),
        startedAt: stepStartedAt,
      },
    });

    try {
      const ctx: AgentContext = {
        role: def.role,
        instructions: prompt.content,
        promptVersion: prompt.version,
        model: provider.model,
        input,
        repo,
        tools: def.tools,
        // Bound to this run/step and this agent's allowlist. Every tool call
        // the provider makes is validated and persisted by runTool.
        callTool: (name, toolInput) =>
          runTool({
            name,
            input: toolInput,
            runId: run.id,
            stepId: step.id,
            repo,
            allowed: def.tools,
            userId,
          }),
      };

      const result = await provider.run(ctx);

      // The type gate: provider output is `unknown` until this parse.
      const parsed = def.outputSchema.safeParse(result.output);
      if (!parsed.success) {
        throw new Error(
          `${def.role} returned output that does not match its contract: ${parsed.error.issues
            .map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`)
            .join("; ")}`
        );
      }

      const completedAt = new Date();
      await db.runStep.update({
        where: { id: step.id },
        data: {
          status: "COMPLETED",
          output: json(parsed.data),
          completedAt,
          latencyMs: completedAt.getTime() - stepStartedAt.getTime(),
          estTokens: result.estTokens,
        },
      });
      totalTokens += result.estTokens;
      assignState(state, def.role, parsed.data);
    } catch (err) {
      // ── Failure: preserve the partial trace ───────────────────────────────
      const message = messageOf(err);
      const failedAt = new Date();

      await db.runStep.update({
        where: { id: step.id },
        data: {
          status: "FAILED",
          error: message,
          completedAt: failedAt,
          latencyMs: failedAt.getTime() - stepStartedAt.getTime(),
        },
      });

      // Everything downstream never ran.
      for (let j = i + 1; j < PIPELINE.length; j++) {
        const skipped = PIPELINE[j];
        await db.runStep.create({
          data: {
            runId: run.id,
            agentId: agentsByRole.get(skipped.role)!.id,
            role: skipped.role,
            order: j + 1,
            status: "SKIPPED",
            input: json({}),
          },
        });
      }

      const completedAt = new Date();
      await db.agentRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          failureReason: `${def.role} step failed: ${message}`,
          completedAt,
          totalLatencyMs: completedAt.getTime() - startedAt.getTime(),
          estTokens: totalTokens,
          estCostUsd: estimateCost(provider.model, totalTokens),
        },
      });
      await logAudit({
        userId,
        action: "run.failed",
        entity: "AgentRun",
        entityId: run.id,
        metadata: { role: def.role, stepId: step.id, message },
      });

      return { runId: run.id, status: "FAILED" };
    }
  }

  // ── 4. Persist the evaluation ─────────────────────────────────────────────
  // The evaluator's output carries score/result/rubric/feedback, so everything
  // EvaluationResult needs is here (feedback is a NOT NULL column).
  const evaluation = state.evaluator!;
  await db.evaluationResult.create({
    data: {
      runId: run.id,
      score: evaluation.score,
      result: evaluation.result,
      rubric: json(evaluation.rubric),
      feedback: evaluation.feedback,
    },
  });

  // ── 5. Complete the run ───────────────────────────────────────────────────
  const completedAt = new Date();
  await db.agentRun.update({
    where: { id: run.id },
    data: {
      status: "COMPLETED",
      finalOutput: json(state.documentation),
      completedAt,
      totalLatencyMs: completedAt.getTime() - startedAt.getTime(),
      estTokens: totalTokens,
      estCostUsd: estimateCost(provider.model, totalTokens),
    },
  });
  await logAudit({
    userId,
    action: "run.completed",
    entity: "AgentRun",
    entityId: run.id,
    metadata: { score: evaluation.score, result: evaluation.result },
  });

  return { runId: run.id, status: "COMPLETED" };
}
