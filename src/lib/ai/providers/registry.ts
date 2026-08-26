import "server-only";
import { createOpenAiProvider } from "@/lib/ai/providers/openai-provider";
import { createMockAiProvider } from "@/lib/ai/providers/mock-provider";
import type { AiProvider } from "@/lib/ai/types/ai-types";

// AI_PROVIDER / AI_API_KEY / AI_MODEL / AI_BASE_URL (Part 1) — never read
// anywhere except here and never forwarded to the client. No AI_API_KEY set
// falls back to the mock provider automatically rather than throwing, so the
// rest of the CRM keeps working without one configured (Part 21).
export function getAiProvider(): AiProvider {
  const providerName = process.env.AI_PROVIDER ?? "openai";
  const apiKey = process.env.AI_API_KEY;

  if (providerName === "mock" || !apiKey) {
    return createMockAiProvider();
  }

  return createOpenAiProvider({
    apiKey,
    model: process.env.AI_MODEL ?? "gpt-4o-mini",
    baseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
  });
}

export function isUsingRealAiProvider(): boolean {
  return Boolean(process.env.AI_API_KEY) && process.env.AI_PROVIDER !== "mock";
}
