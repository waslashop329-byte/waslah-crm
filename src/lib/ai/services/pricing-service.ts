import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CostEstimate {
  cost: number | null;
  isEstimated: boolean;
}

// Pricing lives in ai_model_pricing (Part 16), never hardcoded here. Picks
// the most recent row effective at-or-before now, so pricing changes don't
// retroactively rewrite the cost of past requests.
export async function estimateCost(provider: string, model: string, inputTokens: number | null, outputTokens: number | null): Promise<CostEstimate> {
  if (inputTokens === null || outputTokens === null) {
    return { cost: null, isEstimated: true };
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ai_model_pricing")
    .select("*")
    .eq("provider", provider)
    .eq("model", model)
    .lte("effective_from", new Date().toISOString())
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { cost: null, isEstimated: true };
  }

  const cost = (inputTokens / 1000) * data.input_price_per_1k + (outputTokens / 1000) * data.output_price_per_1k;
  return { cost: Math.round(cost * 1_000_000) / 1_000_000, isEstimated: false };
}
