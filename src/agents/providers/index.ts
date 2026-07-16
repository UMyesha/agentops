import type { AgentProvider } from "@/agents/provider";
import { MockAgentProvider } from "@/agents/providers/mock";
import { OpenAIAgentProvider } from "@/agents/providers/openai";

export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigError";
  }
}

/**
 * Resolve the configured provider. Mock is the default so the app runs with no
 * API key. The runner never branches on which provider it got.
 */
export function getProvider(): AgentProvider {
  const kind = (process.env.AI_PROVIDER ?? "mock").toLowerCase();

  if (kind === "mock") return new MockAgentProvider();

  if (kind === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ProviderConfigError(
        'AI_PROVIDER is "openai" but OPENAI_API_KEY is not set.'
      );
    }
    return new OpenAIAgentProvider(apiKey, process.env.OPENAI_MODEL ?? "gpt-4o-mini");
  }

  throw new ProviderConfigError(
    `Unknown AI_PROVIDER "${kind}". Expected "mock" or "openai".`
  );
}

export { MockAgentProvider, OpenAIAgentProvider };
