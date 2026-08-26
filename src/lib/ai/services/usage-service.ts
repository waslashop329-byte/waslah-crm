import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCost } from "@/lib/ai/services/pricing-service";
import type { AiFeature, AiUsageLogRow } from "@/lib/types/database";
import type { AiUsageInfo } from "@/lib/ai/types/ai-types";

interface LogUsageParams {
  userId: string | null;
  feature: AiFeature;
  entityType?: string;
  entityId?: string;
  provider: string;
  model: string;
  usage: AiUsageInfo;
  durationMs: number;
  status: "success" | "failed";
  error?: string;
}

// The single place every AI call's usage gets recorded (Part 15: "do not
// scatter usage logging throughout the application") — every service in
// lib/ai/services calls this exactly once per provider call, success or failure.
export async function logAiUsage(params: LogUsageParams): Promise<AiUsageLogRow | null> {
  const supabase = createAdminClient();
  const { cost, isEstimated } = await estimateCost(params.provider, params.model, params.usage.inputTokens, params.usage.outputTokens);

  const { data, error } = await supabase
    .from("ai_usage_logs")
    .insert({
      user_id: params.userId,
      feature: params.feature,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      provider: params.provider,
      model: params.model,
      input_tokens: params.usage.inputTokens,
      output_tokens: params.usage.outputTokens,
      estimated_cost: cost,
      cost_is_estimated: isEstimated,
      duration_ms: params.durationMs,
      status: params.status,
      error: params.error ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to log AI usage", { params, error });
    return null;
  }

  return data;
}
