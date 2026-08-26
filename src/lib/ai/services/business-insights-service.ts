import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAiProvider } from "@/lib/ai/providers/registry";
import { generateStructuredOutput } from "@/lib/ai/services/structured-output-service";
import { logAiUsage } from "@/lib/ai/services/usage-service";
import { buildBusinessMetricsSnapshot } from "@/lib/ai/context/business-metrics-builder";
import { businessInsightsSchema, BUSINESS_INSIGHTS_SCHEMA_DESCRIPTION } from "@/lib/ai/schemas/business-insight-schema";
import type { AiInsightRow, Json } from "@/lib/types/database";

// Part 10: generation is always explicit (manual button or a future
// scheduled job calling this same function) — never triggered by a page
// load, so viewing /ai-insights is always free/instant regardless of how
// expensive generating a fresh batch is.
export async function generateBusinessInsights(userId: string | null): Promise<AiInsightRow[]> {
  const metrics = await buildBusinessMetricsSnapshot();
  const snapshotHash = createHash("sha256").update(JSON.stringify(metrics)).digest("hex");

  const provider = getAiProvider();
  const startedAt = Date.now();

  const systemPrompt =
    "You analyze aggregated CRM business metrics (already computed — do not recompute anything) and identify meaningful patterns. " +
    "Every fact_summary must be traceable to a specific number in the metrics given. Skip a category entirely if nothing meaningful stands out — do not force an insight.";
  const userPrompt = `Business metrics snapshot:\n${JSON.stringify(metrics, null, 2)}\n\nIdentify the most useful insights now.`;

  try {
    const result = await generateStructuredOutput(provider, {
      systemPrompt,
      userPrompt,
      schema: businessInsightsSchema,
      schemaDescription: BUSINESS_INSIGHTS_SCHEMA_DESCRIPTION,
    });

    await logAiUsage({
      userId,
      feature: "business_insight",
      provider: provider.name,
      model: provider.model,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      status: "success",
    });

    if (result.data.insights.length === 0) return [];

    const supabase = createAdminClient();
    const { data: inserted, error } = await supabase
      .from("ai_insights")
      .insert(
        result.data.insights.map((insight) => ({
          category: insight.category,
          title: insight.title,
          description: insight.fact_summary,
          fact_summary: insight.fact_summary,
          inference: insight.inference,
          recommended_action: insight.recommended_action,
          supporting_metrics: JSON.parse(JSON.stringify(metrics)) as Json,
          priority: insight.priority,
          confidence: insight.confidence,
          provider: provider.name,
          model: provider.model,
          data_snapshot_hash: snapshotHash,
        })),
      )
      .select();

    if (error) throw new Error(error.message);
    return inserted ?? [];
  } catch (error) {
    await logAiUsage({
      userId,
      feature: "business_insight",
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

export async function listRecentInsights(limit = 20): Promise<AiInsightRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("ai_insights").select("*").order("generated_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
