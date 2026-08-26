// Minimal provider contract (Part 1). Deliberately does NOT include a
// "structured output" method — that's a higher-level capability built once,
// on top of generateText(), in services/structured-output-service.ts, so
// every provider gets it for free instead of each one reimplementing JSON
// Schema handling differently.
export interface AiUsageInfo {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface TextGenerationParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export interface TextGenerationResult {
  text: string;
  usage: AiUsageInfo;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments. */
  parameters: Record<string, unknown>;
}

export interface RequestedToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatParams {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
}

export interface ChatResult {
  content: string | null;
  toolCalls: RequestedToolCall[];
  usage: AiUsageInfo;
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generateText(params: TextGenerationParams): Promise<TextGenerationResult>;
  chat(params: ChatParams): Promise<ChatResult>;
}
