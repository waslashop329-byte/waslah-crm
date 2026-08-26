import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAiProvider } from "@/lib/ai/providers/registry";
import { generateStructuredOutput } from "@/lib/ai/services/structured-output-service";
import { logAiUsage } from "@/lib/ai/services/usage-service";
import { buildCustomerAiContext, hashCustomerAiContext } from "@/lib/ai/context/customer-context-builder";
import { buildCustomerSummaryPrompt } from "@/lib/ai/prompts/customer-summary-prompt";
import { customerSummarySchema, CUSTOMER_SUMMARY_SCHEMA_DESCRIPTION } from "@/lib/ai/schemas/customer-summary-schema";
import type { AiCustomerSummaryRow } from "@/lib/types/database";

export interface CustomerSummaryResult {
  summary: AiCustomerSummaryRow;
  reused: boolean;
}

// Freshness (Part 4): if the stored summary's snapshot hash still matches
// the customer's *current* data, reuse it — never regenerate an unchanged
// customer just because someone opened the profile again.
export async function getOrGenerateCustomerSummary(customerId: string, userId: string | null, forceRegenerate = false): Promise<CustomerSummaryResult> {
  const supabase = createAdminClient();

  const context = await buildCustomerAiContext(customerId);
  if (!context) throw new Error("Customer not found");

  const snapshotHash = hashCustomerAiContext(context);

  if (!forceRegenerate) {
    const { data: existing } = await supabase.from("ai_customer_summaries").select("*").eq("customer_id", customerId).maybeSingle();
    if (existing && existing.data_snapshot_hash === snapshotHash && !existing.is_stale) {
      return { summary: existing, reused: true };
    }
  }

  const provider = getAiProvider();
  const { systemPrompt, userPrompt } = buildCustomerSummaryPrompt(context);
  const startedAt = Date.now();

  try {
    const result = await generateStructuredOutput(provider, {
      systemPrompt,
      userPrompt,
      schema: customerSummarySchema,
      schemaDescription: CUSTOMER_SUMMARY_SCHEMA_DESCRIPTION,
    });

    await logAiUsage({
      userId,
      feature: "customer_summary",
      entityType: "customer",
      entityId: customerId,
      provider: provider.name,
      model: provider.model,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      status: "success",
    });

    const { data: saved, error } = await supabase
      .from("ai_customer_summaries")
      .upsert({
        customer_id: customerId,
        summary: result.data.summary,
        key_points: result.data.key_points,
        concerns: result.data.concerns,
        recommended_action: result.data.recommended_action,
        data_snapshot_hash: snapshotHash,
        is_stale: false,
        provider: provider.name,
        model: provider.model,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !saved) throw new Error(error?.message ?? "Failed to store AI summary");

    return { summary: saved, reused: false };
  } catch (error) {
    await logAiUsage({
      userId,
      feature: "customer_summary",
      entityType: "customer",
      entityId: customerId,
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

export async function getCustomerSummaryIfExists(customerId: string): Promise<AiCustomerSummaryRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("ai_customer_summaries").select("*").eq("customer_id", customerId).maybeSingle();
  return data ?? null;
}

// Called by the AI staleness subscriber (customer.updated / order.* events) —
// never regenerates synchronously, just flags it so the next view/manual
// refresh knows to regenerate (Part 21: no AI calls inside critical paths).
export async function markCustomerSummaryStale(customerId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("ai_customer_summaries").update({ is_stale: true }).eq("customer_id", customerId);
}
