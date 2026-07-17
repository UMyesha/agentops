import type { AgentProvider } from "@/agents/provider";
import { getProvider, ProviderConfigError } from "@/agents/providers";
import { PIPELINE, REQUIRED_ROLES } from "@/agents/definitions";
import { isToolName } from "@/tools/registry";
import type { AgentRoleName } from "@/types";
import type { WorkflowForExecution } from "@/lib/queries/workflows";

/**
 * A workflow that cannot be executed as configured. This is NOT a run failure:
 * it is raised before any row is written, so a misconfigured workflow never
 * creates a junk FAILED run that would pollute the trace list and drag down the
 * dashboard's success-rate metric. Surfaces as HTTP 422.
 */
export class WorkflowConfigError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Workflow is not runnable: ${issues.join(" ")}`);
    this.name = "WorkflowConfigError";
    this.issues = issues;
  }
}

export type ExecutableAgent = WorkflowForExecution["agents"][number];

export interface PreflightResult {
  provider: AgentProvider;
  /** Agents keyed by role, each guaranteed to have exactly one active prompt. */
  agentsByRole: Map<AgentRoleName, ExecutableAgent>;
}

/**
 * Validate everything the runner depends on, before it writes anything:
 * the five roles exist exactly once and in order, each has exactly one active
 * prompt version, every tool the pipeline needs is registered and seeded, and
 * the selected provider is configured.
 */
export function preflightWorkflow(params: {
  workflow: WorkflowForExecution;
  dbToolNames: readonly string[];
  /** Injected in tests; otherwise resolved from AI_PROVIDER. */
  provider?: AgentProvider;
}): PreflightResult {
  const { workflow, dbToolNames } = params;
  const issues: string[] = [];
  const agents = workflow.agents; // ordered by `order` asc

  // 1. Exactly the required roles, each once, in the correct order.
  if (agents.length !== REQUIRED_ROLES.length) {
    issues.push(
      `Expected ${REQUIRED_ROLES.length} agents (${REQUIRED_ROLES.join(" → ")}), found ${agents.length}.`
    );
  }
  REQUIRED_ROLES.forEach((role, i) => {
    const actual = agents[i]?.role;
    if (actual !== role) {
      issues.push(
        `Agent at position ${i + 1} must be ${role}, found ${actual ?? "nothing"}.`
      );
    }
  });
  const seen = new Set<string>();
  for (const a of agents) {
    if (seen.has(a.role)) issues.push(`Duplicate agent role ${a.role}.`);
    seen.add(a.role);
  }

  // 2. Exactly one active prompt version per agent.
  for (const a of agents) {
    const n = a.promptVersions.length;
    if (n === 0) {
      issues.push(`Agent "${a.name}" (${a.role}) has no active prompt version.`);
    } else if (n > 1) {
      issues.push(
        `Agent "${a.name}" (${a.role}) has ${n} active prompt versions; expected exactly one.`
      );
    }
  }

  // 3. Every tool the pipeline needs is registered and seeded.
  const needed = new Set(PIPELINE.flatMap((d) => d.tools));
  for (const name of needed) {
    if (!isToolName(name)) {
      issues.push(`Tool "${name}" is not registered.`);
    } else if (!dbToolNames.includes(name)) {
      issues.push(`Tool "${name}" is missing from the tool registry table.`);
    }
  }

  // 4. Provider is configured.
  let provider: AgentProvider | undefined = params.provider;
  if (!provider) {
    try {
      provider = getProvider();
    } catch (err) {
      issues.push(
        err instanceof ProviderConfigError
          ? err.message
          : `Provider is not configured: ${String(err)}`
      );
    }
  }

  if (issues.length > 0 || !provider) {
    throw new WorkflowConfigError(
      issues.length > 0 ? issues : ["Provider could not be resolved."]
    );
  }

  const agentsByRole = new Map<AgentRoleName, ExecutableAgent>(
    agents.map((a) => [a.role as AgentRoleName, a])
  );

  return { provider, agentsByRole };
}
