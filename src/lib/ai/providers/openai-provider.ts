import "server-only";
import type {
  AiProvider,
  ChatParams,
  ChatResult,
  RequestedToolCall,
  TextGenerationParams,
  TextGenerationResult,
} from "@/lib/ai/types/ai-types";

interface OpenAiProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

// Talks to any OpenAI-compatible /chat/completions endpoint via plain fetch —
// no SDK dependency, so swapping the actual provider later only means
// pointing AI_BASE_URL somewhere else or writing one more file this size.
export function createOpenAiProvider(config: OpenAiProviderConfig): AiProvider {
  async function callChatCompletions(body: Record<string, unknown>): Promise<{
    content: string | null;
    toolCalls: RequestedToolCall[];
    inputTokens: number | null;
    outputTokens: number | null;
  }> {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ model: config.model, ...body }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`AI provider request failed (${response.status}): ${errorText.slice(0, 300)}`);
    }

    const json = (await response.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const message = json.choices?.[0]?.message;
    const toolCalls: RequestedToolCall[] = (message?.tool_calls ?? []).map((call) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments);
      } catch {
        // Malformed tool-call arguments — treat as no arguments rather than crash the caller.
      }
      return { id: call.id, name: call.function.name, arguments: args };
    });

    return {
      content: message?.content ?? null,
      toolCalls,
      inputTokens: json.usage?.prompt_tokens ?? null,
      outputTokens: json.usage?.completion_tokens ?? null,
    };
  }

  return {
    name: "openai",
    model: config.model,

    async generateText(params: TextGenerationParams): Promise<TextGenerationResult> {
      const result = await callChatCompletions({
        messages: [
          { role: "system", content: params.systemPrompt },
          { role: "user", content: params.userPrompt },
        ],
        temperature: params.temperature ?? 0.3,
      });

      return {
        text: result.content ?? "",
        usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
      };
    },

    async chat(params: ChatParams): Promise<ChatResult> {
      const messages = params.messages.map((m) =>
        m.role === "tool"
          ? { role: "tool", content: m.content, tool_call_id: m.toolCallId, name: m.toolName }
          : { role: m.role, content: m.content },
      );

      const tools = params.tools?.map((tool) => ({
        type: "function",
        function: { name: tool.name, description: tool.description, parameters: tool.parameters },
      }));

      const result = await callChatCompletions({ messages, ...(tools ? { tools } : {}) });

      return {
        content: result.content,
        toolCalls: result.toolCalls,
        usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
      };
    },
  };
}
