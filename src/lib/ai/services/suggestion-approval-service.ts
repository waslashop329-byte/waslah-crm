import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { automationActionSchema } from "@/lib/intelligence/automation/action-schema";
import { executeAction } from "@/lib/intelligence/automation/action-handlers";
import { recordAudit } from "@/lib/services/audit-service";
import type { AiSuggestionRow } from "@/lib/types/database";

// Approval executes through the exact same Action Handler pattern the
// automation engine uses (Phase 4) — an AI suggestion's proposed_action is
// stored in the same shape an automation rule's action is, so approving it
// and running an automation action are, deliberately, the same code path.
// Nothing in this file talks to the AI provider or has any special
// database-write privilege the rest of the app doesn't already have.
export async function approveSuggestion(suggestionId: string, actorId: string): Promise<AiSuggestionRow> {
  const supabase = createAdminClient();

  const { data: suggestion, error: fetchError } = await supabase.from("ai_suggestions").select("*").eq("id", suggestionId).single();
  if (fetchError || !suggestion) throw new Error(fetchError?.message ?? "Suggestion not found");
  if (suggestion.status !== "pending") throw new Error(`Suggestion is already ${suggestion.status}`);
  if (suggestion.expires_at && new Date(suggestion.expires_at) < new Date()) {
    await supabase.from("ai_suggestions").update({ status: "expired" }).eq("id", suggestionId);
    throw new Error("This suggestion has expired");
  }

  await supabase.from("ai_suggestions").update({ status: "approved", reviewed_by: actorId, reviewed_at: new Date().toISOString() }).eq("id", suggestionId);

  if (!suggestion.proposed_action || !suggestion.customer_id) {
    // A recommendation with nothing concrete to execute (e.g. free-text
    // "call the customer") — approving it just records the decision.
    const { data: applied } = await supabase.from("ai_suggestions").update({ status: "applied" }).eq("id", suggestionId).select().single();
    return applied ?? suggestion;
  }

  const actionResult = automationActionSchema.safeParse(suggestion.proposed_action);
  if (!actionResult.success) {
    const { data: failed } = await supabase
      .from("ai_suggestions")
      .update({ status: "failed", error: "Stored action no longer matches the expected schema" })
      .eq("id", suggestionId)
      .select()
      .single();
    return failed ?? suggestion;
  }

  try {
    await executeAction(actionResult.data, { customerId: suggestion.customer_id, automationRuleId: "ai_suggestion" });

    const { data: applied, error: applyError } = await supabase
      .from("ai_suggestions")
      .update({ status: "applied", applied_result: { action: actionResult.data.type } })
      .eq("id", suggestionId)
      .select()
      .single();
    if (applyError || !applied) throw new Error(applyError?.message ?? "Failed to record applied suggestion");

    await recordAudit({
      actorId,
      action: "ai_suggestion.approved",
      entityType: "ai_suggestion",
      entityId: suggestionId,
      afterData: { type: suggestion.type, action: actionResult.data.type, customer_id: suggestion.customer_id },
    });

    return applied;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const { data: failed } = await supabase.from("ai_suggestions").update({ status: "failed", error: message }).eq("id", suggestionId).select().single();
    return failed ?? suggestion;
  }
}

export async function rejectSuggestion(suggestionId: string, actorId: string): Promise<AiSuggestionRow> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("ai_suggestions")
    .update({ status: "rejected", reviewed_by: actorId, reviewed_at: new Date().toISOString() })
    .eq("id", suggestionId)
    .eq("status", "pending")
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Suggestion not found or already reviewed");

  await recordAudit({ actorId, action: "ai_suggestion.rejected", entityType: "ai_suggestion", entityId: suggestionId });

  return data;
}
