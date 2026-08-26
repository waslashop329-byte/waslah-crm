import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAiProvider } from "@/lib/ai/providers/registry";
import { generateStructuredOutput } from "@/lib/ai/services/structured-output-service";
import { logAiUsage } from "@/lib/ai/services/usage-service";
import { buildCallNoteAnalysisPrompt } from "@/lib/ai/prompts/call-note-analysis-prompt";
import { callNoteAnalysisSchema, CALL_NOTE_ANALYSIS_SCHEMA_DESCRIPTION } from "@/lib/ai/schemas/call-note-analysis-schema";
import type { CallAttemptAnalysisRow } from "@/lib/types/database";

export async function analyzeCallNote(callAttemptId: string, userId: string | null): Promise<CallAttemptAnalysisRow> {
  const supabase = createAdminClient();

  const { data: attempt } = await supabase
    .from("order_call_attempts")
    .select("result, notes, reason_category, orders(status, total_amount)")
    .eq("id", callAttemptId)
    .single();

  if (!attempt || !attempt.notes) {
    throw new Error("This call attempt has no notes to analyze");
  }

  const order = attempt.orders as unknown as { status: string; total_amount: number } | null;

  const provider = getAiProvider();
  const { systemPrompt, userPrompt } = buildCallNoteAnalysisPrompt({
    result: attempt.result,
    notes: attempt.notes,
    reasonCategory: attempt.reason_category,
    orderStatus: order?.status ?? "unknown",
    orderTotal: order?.total_amount ?? 0,
  });
  const startedAt = Date.now();

  try {
    const result = await generateStructuredOutput(provider, {
      systemPrompt,
      userPrompt,
      schema: callNoteAnalysisSchema,
      schemaDescription: CALL_NOTE_ANALYSIS_SCHEMA_DESCRIPTION,
    });

    await logAiUsage({
      userId,
      feature: "call_note_analysis",
      entityType: "order_call_attempt",
      entityId: callAttemptId,
      provider: provider.name,
      model: provider.model,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      status: "success",
    });

    const { data: saved, error } = await supabase
      .from("call_attempt_analysis")
      .upsert({
        call_attempt_id: callAttemptId,
        quality_score: result.data.quality_score,
        attempted_upsell: result.data.attempted_upsell,
        customer_objection: result.data.customer_objection,
        improvement_suggestion: result.data.improvement_suggestion,
        provider: provider.name,
        model: provider.model,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !saved) throw new Error(error?.message ?? "Failed to store call note analysis");
    return saved;
  } catch (error) {
    await logAiUsage({
      userId,
      feature: "call_note_analysis",
      entityType: "order_call_attempt",
      entityId: callAttemptId,
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

export async function getCallNoteAnalysisIfExists(callAttemptId: string): Promise<CallAttemptAnalysisRow | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("call_attempt_analysis").select("*").eq("call_attempt_id", callAttemptId).maybeSingle();
  return data ?? null;
}
