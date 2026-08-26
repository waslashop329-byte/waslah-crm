import "server-only";
import type { AiProvider, ChatParams, ChatResult, TextGenerationParams, TextGenerationResult } from "@/lib/ai/types/ai-types";

// Structured-output requests (structured-output-service.ts) always ask for
// one of a small, fixed set of JSON shapes defined in lib/ai/schemas/*. Free
// prose (the old behavior) can never pass Zod validation, which made every
// structured AI feature fail whenever no real AI_API_KEY was configured —
// not just look like a placeholder, but actually error. Each fixture here is
// a genuinely schema-valid instance, matched by a field name unique to that
// schema, so the mock provider exercises the real validation/storage path
// end-to-end while still being unmistakably fake content.
const STRUCTURED_MOCKS: { marker: string; json: unknown }[] = [
  {
    marker: "key_points",
    json: {
      summary: "Mock summary — connect a real AI_API_KEY to generate an actual analysis of this customer.",
      key_points: ["Placeholder data point from the mock provider"],
      concerns: [],
      recommended_action: "Mock recommendation — connect a real AI_API_KEY",
    },
  },
  {
    marker: "proposed_follow_up",
    json: {
      recommended_action: "Mock recommendation — connect a real AI_API_KEY",
      reason: "This is placeholder reasoning from the mock provider, not a real analysis grounded in this customer's data.",
      priority: "medium",
      confidence: 0.5,
      suggested_timing: "within a few days",
      proposed_follow_up: { type: "general", title: "Mock follow-up — connect a real AI_API_KEY", days_from_now: 2 },
    },
  },
  {
    marker: "tag_name",
    // Left empty on purpose: the guardrail that filters suggested tags down
    // to this customer's actual available tag list would drop any name the
    // mock invented anyway, so an empty list here reflects reality rather
    // than showing a suggestion that gets silently discarded downstream.
    json: { suggestions: [] },
  },
  {
    marker: "supporting_factors",
    json: {
      explanation: "Mock explanation — connect a real AI_API_KEY to generate an actual risk analysis for this customer.",
      supporting_factors: ["Placeholder factor from the mock provider"],
      recent_changes: null,
    },
  },
  {
    marker: "keep_separate",
    json: {
      recommendation: "review",
      confidence: 0.5,
      reasons: ["Mock analysis — connect a real AI_API_KEY for an actual comparison of these two customers."],
    },
  },
  {
    marker: "attempted_upsell",
    json: {
      quality_score: 65,
      attempted_upsell: false,
      customer_objection: "Mock objection — connect a real AI_API_KEY for a real read of this note.",
      improvement_suggestion: "Mock suggestion — connect a real AI_API_KEY for real coaching feedback.",
    },
  },
  {
    marker: "fact_summary",
    json: {
      insights: [
        {
          category: "cancellation",
          title: "Mock insight — connect a real AI_API_KEY for real analysis",
          fact_summary: "This is placeholder text from the mock provider, not a real analysis of your business metrics.",
          inference: null,
          recommended_action: null,
          priority: "low",
          confidence: 0.5,
        },
      ],
    },
  },
];

function findStructuredMockJson(systemPrompt: string): string | null {
  const match = STRUCTURED_MOCKS.find((m) => systemPrompt.includes(m.marker));
  return match ? JSON.stringify(match.json) : null;
}

// Development/test provider (Part 1: "Test with a simple development
// provider... if credentials are unavailable"). Returns deterministic,
// clearly-labeled placeholder content — never silently pretends to be a real
// model's output. Same role as the mock integration provider in Phase 3.
export function createMockAiProvider(): AiProvider {
  return {
    name: "mock",
    model: "mock-model",

    async generateText(params: TextGenerationParams): Promise<TextGenerationResult> {
      const text =
        findStructuredMockJson(params.systemPrompt) ??
        `[mock AI response] Based on the provided data, here is a placeholder analysis. (system: ${params.systemPrompt.slice(0, 40)}…)`;
      return { text, usage: { inputTokens: estimateTokens(params.systemPrompt + params.userPrompt), outputTokens: estimateTokens(text) } };
    },

    async chat(params: ChatParams): Promise<ChatResult> {
      const lastUserMessage = [...params.messages].reverse().find((m) => m.role === "user");
      const content = `[mock AI assistant] I received your question: "${lastUserMessage?.content ?? ""}". This is a placeholder response — connect a real AI_API_KEY to get real answers.`;
      return {
        content,
        toolCalls: [],
        usage: { inputTokens: estimateTokens(params.messages.map((m) => m.content).join(" ")), outputTokens: estimateTokens(content) },
      };
    },
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
