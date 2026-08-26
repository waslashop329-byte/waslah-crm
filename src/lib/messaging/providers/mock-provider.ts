import "server-only";
import type { MessagingProvider, SendMessageParams, SendMessageResult } from "@/lib/messaging/types/messaging-types";

// Development/test provider — same role as the mock AI provider and the mock
// integration provider: always "succeeds" so every UI/automation path is
// genuinely exercisable without real credentials, but never pretends the
// message actually reached anyone. Logged, never sent.
export function createMockMessagingProvider(): MessagingProvider {
  return {
    name: "mock",

    async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
      console.log(`[mock messaging] Would send ${params.channel} to ${params.to}: "${params.body.slice(0, 80)}"`);
      return { success: true, providerMessageId: `mock-${Date.now()}`, error: null };
    },
  };
}
