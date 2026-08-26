import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAiProvider } from "@/lib/ai/providers/registry";
import { generateStructuredOutput } from "@/lib/ai/services/structured-output-service";
import { logAiUsage } from "@/lib/ai/services/usage-service";
import { duplicateAnalysisSchema, DUPLICATE_ANALYSIS_SCHEMA_DESCRIPTION } from "@/lib/ai/schemas/duplicate-analysis-schema";
import type { DuplicateAnalysisOutput } from "@/lib/ai/schemas/duplicate-analysis-schema";

// Part 8: an additional analysis layer on top of the rule-based duplicate
// engine (Phase 4) — never a replacement, and never able to merge anything
// itself. The rule engine's own confidence_score/signals are included in the
// context so the AI is reasoning alongside the existing math, not blind to it.
export async function analyzeDuplicateCandidate(candidateId: string, userId: string | null): Promise<DuplicateAnalysisOutput> {
  const supabase = createAdminClient();

  const { data: candidate } = await supabase.from("duplicate_candidates").select("*").eq("id", candidateId).single();
  if (!candidate) throw new Error("Duplicate candidate not found");

  const [{ data: customerA }, { data: customerB }, { data: phonesA }, { data: phonesB }, { data: addressesA }, { data: addressesB }] = await Promise.all([
    supabase.from("customers").select("full_name, email, customer_since").eq("id", candidate.customer_id_a).single(),
    supabase.from("customers").select("full_name, email, customer_since").eq("id", candidate.customer_id_b).single(),
    supabase.from("customer_phones").select("phone").eq("customer_id", candidate.customer_id_a),
    supabase.from("customer_phones").select("phone").eq("customer_id", candidate.customer_id_b),
    supabase.from("customer_addresses").select("address_line, city").eq("customer_id", candidate.customer_id_a),
    supabase.from("customer_addresses").select("address_line, city").eq("customer_id", candidate.customer_id_b),
  ]);

  const context = {
    rule_engine_result: { confidence_score: candidate.confidence_score, signals: candidate.signals },
    customer_a: { ...customerA, phones: (phonesA ?? []).map((p) => p.phone), addresses: addressesA ?? [] },
    customer_b: { ...customerB, phones: (phonesB ?? []).map((p) => p.phone), addresses: addressesB ?? [] },
  };

  const provider = getAiProvider();
  const startedAt = Date.now();

  const systemPrompt =
    "You review a possible duplicate customer pair that a rule-based system already flagged. " +
    "Consider name, phone, and address similarity in the data given. You cannot merge anyone — only recommend.";
  const userPrompt = `Duplicate candidate data:\n${JSON.stringify(context, null, 2)}\n\nProvide your recommendation now.`;

  try {
    const result = await generateStructuredOutput(provider, {
      systemPrompt,
      userPrompt,
      schema: duplicateAnalysisSchema,
      schemaDescription: DUPLICATE_ANALYSIS_SCHEMA_DESCRIPTION,
    });

    await logAiUsage({
      userId,
      feature: "duplicate_analysis",
      entityType: "duplicate_candidate",
      entityId: candidateId,
      provider: provider.name,
      model: provider.model,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      status: "success",
    });

    return result.data;
  } catch (error) {
    await logAiUsage({
      userId,
      feature: "duplicate_analysis",
      entityType: "duplicate_candidate",
      entityId: candidateId,
      provider: provider.name,
      model: provider.model,
      usage: { inputTokens: null, outputTokens: null },
      durationMs: Date.now() - startedAt,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
