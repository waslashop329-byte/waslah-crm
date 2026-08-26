import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAiProvider } from "@/lib/ai/providers/registry";
import { logAiUsage } from "@/lib/ai/services/usage-service";
import { redactSecrets, assertToolNameIsRegistered } from "@/lib/ai/guardrails/guardrails";
import { buildAssistantSystemPrompt } from "@/lib/ai/prompts/assistant-prompt";
import { TOOL_DEFINITIONS, TOOL_NAMES, runTool } from "@/lib/ai/tools/tool-registry";
import type { ChatMessage } from "@/lib/ai/types/ai-types";
import type { AiConversationRow, AiMessageRow, Json } from "@/lib/types/database";
import type { CurrentUserContext } from "@/lib/auth/session";

// Loop protection (same philosophy as the automation engine's depth guard,
// Part 21): an AI-requested tool call can never chain indefinitely — after
// this many round trips we force a final answer from whatever the model has
// seen so far rather than let one confused turn burn unbounded API calls.
const MAX_TOOL_ITERATIONS = 4;
const HISTORY_LIMIT = 20;

export interface ToolCallTrace {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

export async function listConversations(userId: string): Promise<AiConversationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_conversations").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getConversationMessages(conversationId: string, userId: string): Promise<AiMessageRow[]> {
  const supabase = await createClient();

  const { data: conversation } = await supabase.from("ai_conversations").select("id").eq("id", conversationId).eq("user_id", userId).maybeSingle();
  if (!conversation) return [];

  const { data, error } = await supabase.from("ai_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function createConversation(userId: string): Promise<AiConversationRow> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("ai_conversations").insert({ user_id: userId, title: null }).select().single();
  if (error || !data) throw new Error(error?.message ?? "Failed to start conversation");
  return data;
}

function toTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;
}

export interface SendAssistantMessageResult {
  conversationId: string;
  userMessage: AiMessageRow;
  assistantMessage: AiMessageRow;
}

// The single entry point for a chat turn (Part 11): persists the user's
// message, runs the tool-calling loop against the AI provider, persists the
// assistant's final reply with its tool trace attached, and logs usage for
// every provider call made along the way. Never executes anything outside
// the registered read-only tools (Part 12: "no arbitrary SQL").
export async function sendAssistantMessage(params: {
  conversationId?: string;
  userText: string;
  user: CurrentUserContext;
}): Promise<SendAssistantMessageResult> {
  const supabase = await createClient();
  const userId = params.user.userId;

  const requestedConversationId = params.conversationId;
  const conversation = requestedConversationId
    ? await (async () => {
        const { data } = await supabase.from("ai_conversations").select("*").eq("id", requestedConversationId).eq("user_id", userId).maybeSingle();
        if (!data) throw new Error("Conversation not found");
        return data;
      })()
    : await createConversation(userId);

  const history = await getConversationMessages(conversation.id, userId);

  const { data: userMessage, error: userMessageError } = await supabase
    .from("ai_messages")
    .insert({ conversation_id: conversation.id, role: "user", content: params.userText, tool_calls: null })
    .select()
    .single();
  if (userMessageError || !userMessage) throw new Error(userMessageError?.message ?? "Failed to save message");

  const provider = getAiProvider();
  const systemPrompt = buildAssistantSystemPrompt();

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-HISTORY_LIMIT).map((m): ChatMessage => ({ role: m.role, content: m.content })),
    { role: "user", content: params.userText },
  ];

  const trace: ToolCallTrace[] = [];
  let finalContent = "";

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const startedAt = Date.now();
    let result;
    try {
      result = await provider.chat({ messages, tools: TOOL_DEFINITIONS });
      await logAiUsage({
        userId,
        feature: "assistant",
        entityType: "ai_conversation",
        entityId: conversation.id,
        provider: provider.name,
        model: provider.model,
        usage: result.usage,
        durationMs: Date.now() - startedAt,
        status: "success",
      });
    } catch (error) {
      await logAiUsage({
        userId,
        feature: "assistant",
        entityType: "ai_conversation",
        entityId: conversation.id,
        provider: provider.name,
        model: provider.model,
        usage: { inputTokens: null, outputTokens: null },
        durationMs: Date.now() - startedAt,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }

    if (result.toolCalls.length === 0) {
      finalContent = result.content ?? "";
      break;
    }

    messages.push({ role: "assistant", content: result.content ?? "" });

    for (const call of result.toolCalls) {
      try {
        assertToolNameIsRegistered(call.name, TOOL_NAMES);
        const toolResult = await runTool(call.name, call.arguments, { user: params.user });
        trace.push({ name: call.name, arguments: call.arguments, result: toolResult });
        messages.push({ role: "tool", content: JSON.stringify(toolResult), toolCallId: call.id, toolName: call.name });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Tool execution failed";
        trace.push({ name: call.name, arguments: call.arguments, error: message });
        messages.push({ role: "tool", content: JSON.stringify({ error: message }), toolCallId: call.id, toolName: call.name });
      }
    }

    // Last allowed iteration produced only tool calls with no final text —
    // fall back to a plain explanation rather than persisting an empty reply.
    if (iteration === MAX_TOOL_ITERATIONS - 1) {
      finalContent = "I gathered some data but couldn't finish forming an answer in time — please rephrase or ask a narrower question.";
    }
  }

  const safeContent = redactSecrets(finalContent || "I couldn't generate a response. Please try again.");

  const { data: assistantMessage, error: assistantMessageError } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: conversation.id,
      role: "assistant",
      content: safeContent,
      tool_calls: trace.length > 0 ? (JSON.parse(JSON.stringify(trace)) as Json) : null,
    })
    .select()
    .single();
  if (assistantMessageError || !assistantMessage) throw new Error(assistantMessageError?.message ?? "Failed to save reply");

  // Single UPDATE either way: sets the title on the first turn, and on every
  // later turn re-writes the same title purely to fire the updated_at
  // trigger (Update's generated type has no updated_at column of its own —
  // it's DB-managed) so the conversation list can sort by recency.
  await supabase.from("ai_conversations").update({ title: conversation.title ?? toTitle(params.userText) }).eq("id", conversation.id);

  return { conversationId: conversation.id, userMessage, assistantMessage };
}
