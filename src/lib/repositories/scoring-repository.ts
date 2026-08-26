import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ScoringRuleRow, ScoreCategoryThresholdRow, ScoreHistoryRow } from "@/lib/types/database";

export async function getScoringRules(): Promise<ScoringRuleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("scoring_rules").select("*").order("key");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getScoreCategoryThresholds(): Promise<ScoreCategoryThresholdRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("score_category_thresholds").select("*").order("min_score", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getScoreHistory(customerId: string, limit = 10): Promise<ScoreHistoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("score_history")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
