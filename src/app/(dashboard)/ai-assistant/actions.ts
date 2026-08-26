"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { sendAssistantMessage } from "@/lib/ai/services/assistant-service";
import type { AiMessageRow } from "@/lib/types/database";

export interface AssistantActionState {
  error?: string;
  conversationId?: string;
  userMessage?: AiMessageRow;
  assistantMessage?: AiMessageRow;
}

const sendMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1, "Type a question first").max(2000),
});

export async function sendAssistantMessageAction(_prevState: AssistantActionState, formData: FormData): Promise<AssistantActionState> {
  const user = await requirePermission("ai.assistant.use");

  const parsed = sendMessageSchema.safeParse({
    conversationId: formData.get("conversationId") || undefined,
    message: formData.get("message"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid message" };

  try {
    const result = await sendAssistantMessage({
      conversationId: parsed.data.conversationId,
      userText: parsed.data.message,
      user,
    });

    revalidatePath("/ai-assistant");

    return {
      conversationId: result.conversationId,
      userMessage: result.userMessage,
      assistantMessage: result.assistantMessage,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to get a response" };
  }
}
