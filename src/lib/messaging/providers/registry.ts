import "server-only";
import { createMockMessagingProvider } from "@/lib/messaging/providers/mock-provider";
import type { MessagingProvider } from "@/lib/messaging/types/messaging-types";

// MESSAGING_PROVIDER / MESSAGING_API_KEY — same shape as the AI provider
// registry. No real provider module exists yet (by design — the user chose
// to stand up the whole Communication Center on the mock provider first and
// wire a real one, e.g. Twilio or Meta's WhatsApp Cloud API, once the rest of
// the CRM is solid). When that happens, add a provider module under
// lib/messaging/providers/ and branch to it here exactly like
// lib/ai/providers/registry.ts does for AI_PROVIDER.
export function getMessagingProvider(): MessagingProvider {
  return createMockMessagingProvider();
}

export function isUsingRealMessagingProvider(): boolean {
  return Boolean(process.env.MESSAGING_API_KEY) && process.env.MESSAGING_PROVIDER !== "mock";
}
