import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { AgentContext, AgentProvider, AgentResult } from "@/agents/provider";
import { TOOLS } from "@/tools/registry";

/**
 * Real-model provider, enabled with AI_PROVIDER=openai.
 *
 * Generic by design: it knows nothing about individual agents. It is handed the
 * agent's DB-loaded instructions, its structured input, and its allowlisted tool
 * schemas, then runs a standard tool-calling loop and returns the model's final
 * JSON as `unknown` — the runner's Zod schema is what validates and narrows it.
 *
 * NOTE: this path has not been executed against the live OpenAI API (no key is
 * configured in this environment). It is covered by typecheck and the provider
 * contract only.
 */
const MAX_TOOL_ITERATIONS = 8;

export class OpenAIAgentProvider implements AgentProvider {
  readonly name = "openai" as const;
  readonly model: string;
  private client: OpenAI;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async run(ctx: AgentContext): Promise<AgentResult> {
    const tools: ChatCompletionTool[] = ctx.tools.map((name) => ({
      type: "function",
      function: {
        name,
        description: TOOLS[name].description,
        parameters: TOOLS[name].jsonSchema,
      },
    }));

    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `${ctx.instructions}\n\nRespond only with a single JSON object matching the required output contract for your role. Do not wrap it in markdown.`,
      },
      {
        role: "user",
        content: `Input (JSON):\n${JSON.stringify(ctx.input)}`,
      },
    ];

    let totalTokens = 0;

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const res = await this.client.chat.completions.create({
        model: this.model,
        messages,
        ...(tools.length > 0 ? { tools } : {}),
        response_format: { type: "json_object" },
      });

      totalTokens += res.usage?.total_tokens ?? 0;
      const msg = res.choices[0]?.message;
      if (!msg) throw new Error("OpenAI returned no message");
      messages.push(msg);

      // Tool round: execute each requested call through the runner's bound
      // callTool (which enforces the allowlist and persists every call). A
      // ToolError propagates and fails the step — intentionally.
      if (msg.tool_calls?.length) {
        for (const call of msg.tool_calls) {
          if (call.type !== "function") continue;
          let args: unknown = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = {};
          }
          const result = await ctx.callTool(call.function.name, args);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result ?? null),
          });
        }
        continue;
      }

      // Final answer.
      const content = msg.content?.trim();
      if (!content) throw new Error("OpenAI returned an empty response");
      let output: unknown;
      try {
        output = JSON.parse(content);
      } catch {
        throw new Error(
          `OpenAI returned non-JSON content for role ${ctx.role}: ${content.slice(0, 200)}`
        );
      }
      return { output, estTokens: totalTokens };
    }

    throw new Error(
      `OpenAI exceeded ${MAX_TOOL_ITERATIONS} tool iterations for role ${ctx.role}`
    );
  }
}
