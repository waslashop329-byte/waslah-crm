import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAiProvider } from "@/lib/ai/providers/registry";
import { generateStructuredOutput } from "@/lib/ai/services/structured-output-service";
import { logAiUsage } from "@/lib/ai/services/usage-service";
import { buildCustomerAiContext } from "@/lib/ai/context/customer-context-builder";
import { nextBestActionSchema, NEXT_BEST_ACTION_SCHEMA_DESCRIPTION } from "@/lib/ai/schemas/next-best-action-schema";
import type { AiSuggestionRow } from "@/lib/types/database";

const SUGGESTION_EXPIRY_DAYS = 7;

// Part 5: the AI never executes anything — this only ever produces a
// *pending* row. Applying it (createFollowUp, the exact same service the
// Follow-ups UI uses) only happens from applyNextBestAction() below, which
// is only ever called after a human approves.
export async function generateNextBestAction(customerId: string, userId: string | null): Promise<AiSuggestionRow> {
  const context = await buildCustomerAiContext(customerId);
  if (!context) throw new Error("Customer not found");

  const provider = getAiProvider();
  const startedAt = Date.now();

  const systemPrompt =
    "You recommend the single most useful next action an employee should take for this customer, grounded only in the data given. " +
    "Prefer concrete, schedulable actions (a call, a WhatsApp message) over vague advice.";
  const userPrompt = `Customer AI Context:\n${JSON.stringify(context, null, 2)}\n\nRecommend the next best action now.`;

  try {
    const result = await generateStructuredOutput(provider, {
      systemPrompt,
      userPrompt,
      schema: nextBestActionSchema,
      schemaDescription: NEXT_BEST_ACTION_SCHEMA_DESCRIPTION,
    });

    const usageLog = await logAiUsage({
      userId,
      feature: "next_best_action",
      entityType: "customer",
      entityId: customerId,
      provider: provider.name,
      model: provider.model,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      status: "success",
    });

    const supabase = createAdminClient();
    const { data: suggestion, error } = await supabase
      .from("ai_suggestions")
      .insert({
        type: "next_best_action",
        customer_id: customerId,
        proposed_action: result.data.proposed_follow_up
          ? {
              type: "create_follow_up",
              followUpType: result.data.proposed_follow_up.type,
              title: result.data.proposed_follow_up.title,
              daysFromNow: result.data.proposed_follow_up.days_from_now,
              priority: result.data.priority,
            }
          : null,
        reason: `${result.data.recommended_action}: ${result.data.reason}`,
        priority: result.data.priority,
        confidence: result.data.confidence,
        suggested_timing: result.data.suggested_timing,
        status: "pending",
        expires_at: new Date(Date.now() + SUGGESTION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        usage_log_id: usageLog?.id ?? null,
      })
      .select()
      .single();

    if (error || !suggestion) throw new Error(error?.message ?? "Failed to store suggestion");
    return suggestion;
  } catch (error) {
    await logAiUsage({
      userId,
      feature: "next_best_action",
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

export async function listPendingSuggestions(customerId: string, type?: AiSuggestionRow["type"]): Promise<AiSuggestionRow[]> {
  const supabase = createAdminClient();
  let query = supabase.from("ai_suggestions").select("*").eq("customer_id", customerId).eq("status", "pending").order("created_at", { ascending: false });
  if (type) query = query.eq("type", type);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}
