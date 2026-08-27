import "server-only";
import { createClient } from "@/lib/supabase/server";
import { calculateAgentPerformance, calculateGoalProgress, type AgentPerformance, type GoalProgress } from "@/lib/intelligence/performance/agent-performance";
import {
  calculateAvgFirstResponseHours,
  calculateAvgComplaintResolutionHours,
  calculateWorkloadBalance,
  type WorkloadBalance,
} from "@/lib/intelligence/performance/ops-metrics";
import type { AgentGoalRow, PerformanceConfigRow } from "@/lib/types/database";

export async function getPerformanceConfig(): Promise<PerformanceConfigRow> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("performance_config").select("*").limit(1).single();
  if (error || !data) throw new Error(error?.message ?? "Performance config not found");
  return data;
}

export interface AgentPerformanceRow extends AgentPerformance {
  agentName: string;
}

// Revenue attribution: an order counts toward whoever logged the "confirmed"
// call attempt on it — once confirmed, that credit stands even if the order
// later cancels (that's a separate risk signal, not this one's job to model).
export async function getAgentLeaderboard(days = 30): Promise<AgentPerformanceRow[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const config = await getPerformanceConfig();

  const { data: attempts, error } = await supabase
    .from("order_call_attempts")
    .select("agent_id, order_id, result, orders(total_amount)")
    .eq("result", "confirmed")
    .gte("attempted_at", since);
  if (error) throw new Error(error.message);

  const { data: followUps } = await supabase
    .from("follow_ups")
    .select("completed_by")
    .eq("status", "completed")
    .gte("completed_at", since)
    .not("completed_by", "is", null);

  const byAgent = new Map<string, { confirmedOrders: number; confirmedRevenue: number; completedFollowUps: number }>();

  for (const attempt of attempts ?? []) {
    const entry = byAgent.get(attempt.agent_id) ?? { confirmedOrders: 0, confirmedRevenue: 0, completedFollowUps: 0 };
    entry.confirmedOrders += 1;
    entry.confirmedRevenue += (attempt.orders as unknown as { total_amount: number } | null)?.total_amount ?? 0;
    byAgent.set(attempt.agent_id, entry);
  }

  for (const followUp of followUps ?? []) {
    const agentId = followUp.completed_by as string;
    const entry = byAgent.get(agentId) ?? { confirmedOrders: 0, confirmedRevenue: 0, completedFollowUps: 0 };
    entry.completedFollowUps += 1;
    byAgent.set(agentId, entry);
  }

  if (byAgent.size === 0) return [];

  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", Array.from(byAgent.keys()));
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const ranked = calculateAgentPerformance(
    Array.from(byAgent.entries()).map(([agentId, activity]) => ({ agentId, ...activity })),
    {
      xpPerConfirmedOrder: config.xp_per_confirmed_order,
      xpPerCompletedFollowup: config.xp_per_completed_followup,
      commissionRatePercent: config.commission_rate_percent,
    },
  );

  return ranked.map((r) => ({ ...r, agentName: nameById.get(r.agentId) ?? "Unknown" }));
}

export async function getAgentGoal(agentId: string, periodMonth: string): Promise<AgentGoalRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("agent_goals").select("*").eq("agent_id", agentId).eq("period_month", periodMonth).maybeSingle();
  return data ?? null;
}

export function getGoalProgressForAgent(agentPerformance: AgentPerformanceRow, goal: AgentGoalRow | null): GoalProgress {
  return calculateGoalProgress(agentPerformance, goal?.target_confirmed_orders ?? 0, goal?.target_revenue ?? 0);
}

export interface TeamOpsMetrics {
  avgFirstResponseHours: number | null;
  avgComplaintResolutionHours: number | null;
  workloadBalance: WorkloadBalance | null;
}

// Phase 14's "CRM operational metrics" — team-efficiency numbers, distinct
// from the revenue-attribution leaderboard above. All three read straight
// from source tables (order_call_attempts, complaints, orders), never a
// stored/cached figure, same "recompute, never drift" convention as the rest
// of this codebase.
export async function getTeamOpsMetrics(days = 30): Promise<TeamOpsMetrics> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("ordered_at, order_call_attempts(attempted_at)")
    .gte("ordered_at", since);
  if (ordersError) throw new Error(ordersError.message);

  const avgFirstResponseHours = calculateAvgFirstResponseHours(
    (orders ?? []).map((o) => {
      const attempts = (o.order_call_attempts as { attempted_at: string }[]) ?? [];
      const firstAttemptAt = attempts.length > 0 ? attempts.map((a) => a.attempted_at).sort()[0] : null;
      return { orderedAt: o.ordered_at, firstAttemptAt };
    }),
  );

  const { data: complaints, error: complaintsError } = await supabase
    .from("complaints")
    .select("created_at, status, updated_at")
    .gte("created_at", since);
  if (complaintsError) throw new Error(complaintsError.message);

  const avgComplaintResolutionHours = calculateAvgComplaintResolutionHours(
    (complaints ?? []).map((c) => ({ createdAt: c.created_at, status: c.status, updatedAt: c.updated_at })),
  );

  const { data: employees, error: employeesError } = await supabase.from("profiles").select("id").eq("is_active", true);
  if (employeesError) throw new Error(employeesError.message);

  const { data: openOrders, error: openOrdersError } = await supabase
    .from("orders")
    .select("assigned_to")
    .not("assigned_to", "is", null)
    .in("status", ["new", "pending"]);
  if (openOrdersError) throw new Error(openOrdersError.message);

  const loadByAgent = new Map<string, number>((employees ?? []).map((e) => [e.id, 0]));
  for (const order of openOrders ?? []) {
    if (order.assigned_to) loadByAgent.set(order.assigned_to, (loadByAgent.get(order.assigned_to) ?? 0) + 1);
  }
  const workloadBalance = calculateWorkloadBalance(Array.from(loadByAgent.entries()).map(([agentId, openOrders]) => ({ agentId, openOrders })));

  return { avgFirstResponseHours, avgComplaintResolutionHours, workloadBalance };
}
