import "server-only";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/services/audit-service";
import type { AgentGoalRow, PerformanceConfigRow } from "@/lib/types/database";

export async function updatePerformanceConfig(
  actorId: string,
  configId: string,
  commissionRatePercent: number,
  xpPerConfirmedOrder: number,
  xpPerCompletedFollowup: number,
): Promise<PerformanceConfigRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("performance_config")
    .update({ commission_rate_percent: commissionRatePercent, xp_per_confirmed_order: xpPerConfirmedOrder, xp_per_completed_followup: xpPerCompletedFollowup })
    .eq("id", configId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to update performance config");

  await recordAudit({ actorId, action: "performance_config.updated", entityType: "performance_config", entityId: configId, afterData: { commission_rate_percent: commissionRatePercent } });
  return data;
}

export async function upsertAgentGoal(
  actorId: string,
  agentId: string,
  periodMonth: string,
  targetConfirmedOrders: number,
  targetRevenue: number,
): Promise<AgentGoalRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agent_goals")
    .upsert({ agent_id: agentId, period_month: periodMonth, target_confirmed_orders: targetConfirmedOrders, target_revenue: targetRevenue }, { onConflict: "agent_id,period_month" })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save goal");

  await recordAudit({ actorId, action: "agent_goal.set", entityType: "agent_goal", entityId: data.id, afterData: { agent_id: agentId, period_month: periodMonth } });
  return data;
}
