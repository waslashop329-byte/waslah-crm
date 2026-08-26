import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AiFeature } from "@/lib/types/database";

// Costs are read through the RLS-scoped client (ai.usage.view gates the page
// that calls this; RLS still applies) — same "wrong client" bug class the
// rest of this codebase has already been burned by, so this deliberately
// does not use the admin client just to make aggregation more convenient.
const USAGE_WINDOW_DAYS = 30;

interface UsageLogSlice {
  feature: AiFeature;
  provider: string;
  model: string;
  user_id: string | null;
  estimated_cost: number | null;
  cost_is_estimated: boolean;
  status: "success" | "failed";
  created_at: string;
}

export interface CostBreakdownEntry {
  key: string;
  label: string;
  cost: number;
  calls: number;
}

export interface AiUsageSummary {
  costToday: number;
  costLast7d: number;
  costLast30d: number;
  callsLast30d: number;
  failedCallsLast30d: number;
  anyCostEstimated: boolean;
  costByFeature: CostBreakdownEntry[];
  costByModel: CostBreakdownEntry[];
  costByUser: CostBreakdownEntry[];
}

export async function getAiUsageSummary(): Promise<AiUsageSummary> {
  const supabase = await createClient();
  const windowStart = new Date(Date.now() - USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("ai_usage_logs")
    .select("feature, provider, model, user_id, estimated_cost, cost_is_estimated, status, created_at")
    .gte("created_at", windowStart)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) throw new Error(error.message);

  const logs = (data ?? []) as UsageLogSlice[];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let costToday = 0;
  let costLast7d = 0;
  let costLast30d = 0;
  let failedCallsLast30d = 0;
  let anyCostEstimated = false;

  const byFeature = new Map<string, { cost: number; calls: number }>();
  const byModel = new Map<string, { cost: number; calls: number }>();
  const byUser = new Map<string, { cost: number; calls: number }>();

  for (const log of logs) {
    const cost = log.estimated_cost ?? 0;
    const createdAt = new Date(log.created_at);

    costLast30d += cost;
    if (createdAt >= sevenDaysAgo) costLast7d += cost;
    if (createdAt >= todayStart) costToday += cost;
    if (log.status === "failed") failedCallsLast30d += 1;
    if (log.cost_is_estimated) anyCostEstimated = true;

    accumulate(byFeature, log.feature, cost);
    accumulate(byModel, `${log.provider}/${log.model}`, cost);
    accumulate(byUser, log.user_id ?? "system", cost);
  }

  const userIds = [...byUser.keys()].filter((id) => id !== "system");
  const userNames = await resolveUserNames(userIds);

  return {
    costToday: round2(costToday),
    costLast7d: round2(costLast7d),
    costLast30d: round2(costLast30d),
    callsLast30d: logs.length,
    failedCallsLast30d,
    anyCostEstimated,
    costByFeature: toSortedEntries(byFeature, (key) => FEATURE_LABELS[key as AiFeature] ?? key),
    costByModel: toSortedEntries(byModel, (key) => key),
    costByUser: toSortedEntries(byUser, (key) => (key === "system" ? "System / automation" : (userNames.get(key) ?? "Unknown user"))),
  };
}

const FEATURE_LABELS: Record<AiFeature, string> = {
  customer_summary: "Customer Summaries",
  next_best_action: "Next Best Action",
  tag_suggestion: "Tag Suggestions",
  risk_explanation: "Risk Explanations",
  duplicate_analysis: "Duplicate Analysis",
  business_insight: "Business Insights",
  assistant: "AI Assistant",
  call_note_analysis: "Call Note Analysis",
};

function accumulate(map: Map<string, { cost: number; calls: number }>, key: string, cost: number): void {
  const existing = map.get(key) ?? { cost: 0, calls: 0 };
  existing.cost += cost;
  existing.calls += 1;
  map.set(key, existing);
}

function toSortedEntries(map: Map<string, { cost: number; calls: number }>, label: (key: string) => string): CostBreakdownEntry[] {
  return [...map.entries()]
    .map(([key, value]) => ({ key, label: label(key), cost: round2(value.cost), calls: value.calls }))
    .sort((a, b) => b.cost - a.cost);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function resolveUserNames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
  return new Map((data ?? []).map((p) => [p.id, p.full_name]));
}
