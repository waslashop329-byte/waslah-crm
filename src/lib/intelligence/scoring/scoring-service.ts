import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordCustomerEvent } from "@/lib/services/timeline-service";
import { dispatchEvent } from "@/lib/events/dispatcher";
import type { ScoreCategory } from "@/lib/types/database";

// Every customer starts neutral, not zero — a brand-new customer with no
// order history yet isn't "high risk", they're simply unscored. Rules then
// push the score up or down from here.
const BASE_SCORE = 50;
const RECENT_ACTIVITY_WINDOW_DAYS = 30;

export interface ScoreBreakdownEntry {
  rule: string;
  weight: number;
  multiplier: number;
  contribution: number;
}

export interface ScoreCalculationResult {
  customerId: string;
  score: number;
  category: ScoreCategory;
  previousScore: number;
  diff: number;
  changed: boolean;
  breakdown: ScoreBreakdownEntry[];
}

// Recomputes the score from the customer's *current* order stats every time
// (never increments a running total) — the same idempotency reasoning as
// recalculateCustomerStats (Phase 3): replaying the same trigger twice must
// never double-count. Rules and category thresholds both come from the
// database (scoring_rules, score_category_thresholds), never hardcoded.
export async function recalculateCustomerScore(
  customerId: string,
  triggerEvent: string,
  reason?: string,
): Promise<ScoreCalculationResult> {
  const supabase = createAdminClient();

  const [{ data: customer, error: customerError }, { data: rules }, { data: orders }, { data: thresholds }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", customerId).single(),
    supabase.from("scoring_rules").select("*").eq("is_active", true),
    supabase.from("orders").select("status").eq("customer_id", customerId),
    supabase.from("score_category_thresholds").select("*"),
  ]);

  if (customerError || !customer) {
    throw new Error(`Customer not found: ${customerError?.message ?? customerId}`);
  }

  const ruleMap = Object.fromEntries((rules ?? []).map((rule) => [rule.key, rule]));
  const failedDeliveryCount = (orders ?? []).filter((order) => order.status === "failed_delivery").length;
  const isRecentlyActive = customer.last_order_at
    ? (Date.now() - new Date(customer.last_order_at).getTime()) / (1000 * 60 * 60 * 24) <= RECENT_ACTIVITY_WINDOW_DAYS
    : false;
  const highValueRule = ruleMap["high_total_value"];
  const isHighValue = highValueRule?.threshold != null && customer.total_spend >= highValueRule.threshold;

  const breakdown: ScoreBreakdownEntry[] = [];
  let raw = BASE_SCORE;

  function apply(key: string, multiplier: number) {
    const rule = ruleMap[key];
    if (!rule || multiplier === 0) return;
    const contribution = rule.weight * multiplier;
    raw += contribution;
    breakdown.push({ rule: rule.label, weight: rule.weight, multiplier, contribution });
  }

  apply("delivered_order", customer.delivered_orders);
  apply("repeat_purchase", customer.total_orders > 1 ? 1 : 0);
  apply("recent_activity_30d", isRecentlyActive ? 1 : 0);
  apply("high_total_value", isHighValue ? 1 : 0);
  apply("cancelled_order", customer.cancelled_orders);
  apply("returned_order", customer.returned_orders);
  apply("refused_shipment", failedDeliveryCount);

  const score = Math.max(0, Math.min(100, Math.round(raw)));
  const category = resolveCategory(score, thresholds ?? []);
  const previousScore = customer.score;
  const diff = score - previousScore;
  const changed = diff !== 0 || category !== customer.score_category;

  if (changed) {
    const explanation = reason ?? summarizeBreakdown(breakdown);

    await supabase.from("customers").update({ score, score_category: category }).eq("id", customerId);

    await supabase.from("score_history").insert({
      customer_id: customerId,
      score,
      category,
      previous_score: previousScore,
      score_diff: diff,
      trigger_event: triggerEvent,
      reason: explanation,
    });

    await recordCustomerEvent({
      customerId,
      eventType: "score.changed",
      title: `Score ${diff > 0 ? "increased" : diff < 0 ? "decreased" : "recalculated"} to ${score}`,
      description: explanation,
    });

    // Not subscribed to by anything that would re-trigger score recalculation —
    // no risk of a customer.score_changed -> ... -> score recalculated loop.
    await dispatchEvent("customer.score_changed", { customerId, previousScore, newScore: score });
  }

  return { customerId, score, category, previousScore, diff, changed, breakdown };
}

function resolveCategory(score: number, thresholds: { category: ScoreCategory; min_score: number }[]): ScoreCategory {
  const sorted = [...thresholds].sort((a, b) => b.min_score - a.min_score);
  for (const threshold of sorted) {
    if (score >= threshold.min_score) return threshold.category;
  }
  return "high_risk";
}

function summarizeBreakdown(breakdown: ScoreBreakdownEntry[]): string {
  if (breakdown.length === 0) return "No scoring signals yet";
  const top = [...breakdown].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 3);
  return top.map((entry) => `${entry.rule} (${entry.contribution > 0 ? "+" : ""}${entry.contribution})`).join(", ");
}
