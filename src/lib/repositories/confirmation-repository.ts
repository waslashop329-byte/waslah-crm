import "server-only";
import { createClient } from "@/lib/supabase/server";
import { calculateConfirmationKpis, type ConfirmationKpis } from "@/lib/intelligence/confirmation/confirmation-metrics";
import type { CallAttemptAnalysisRow, CallAttemptResult, OrderCallAttemptRow, OrderRow } from "@/lib/types/database";

export interface MissionOrder extends OrderRow {
  customer_full_name: string;
}

// "Today's Mission": every order assigned to this agent that hasn't been
// confirmed/cancelled/shipped yet — includes carry-over from previous days
// (Part 7 explicitly wants pending work visible, not just what's dated today).
export async function getTodaysMission(agentId: string): Promise<MissionOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, customers(full_name)")
    .eq("assigned_to", agentId)
    .in("status", ["new", "pending"])
    .order("ordered_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const { customers, ...order } = row as OrderRow & { customers: { full_name: string } | null };
    return { ...order, customer_full_name: customers?.full_name ?? "Unknown customer" };
  });
}

export async function getUnassignedOrders(limit = 50): Promise<MissionOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, customers(full_name)")
    .is("assigned_to", null)
    .in("status", ["new", "pending"])
    .order("ordered_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const { customers, ...order } = row as OrderRow & { customers: { full_name: string } | null };
    return { ...order, customer_full_name: customers?.full_name ?? "Unknown customer" };
  });
}

export interface CallAttemptWithAnalysis extends OrderCallAttemptRow {
  call_attempt_analysis: CallAttemptAnalysisRow | null;
}

export async function getOrderCallAttempts(orderId: string): Promise<CallAttemptWithAnalysis[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_call_attempts")
    .select("*, call_attempt_analysis(*)")
    .eq("order_id", orderId)
    .order("attempted_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CallAttemptWithAnalysis[];
}

// 30-day KPIs (Part 7's "Confirmation Rate, Contact Rate, Average Attempts")
// — assigned orders and their attempts are both fetched fresh, never stored,
// same "recompute, never drift" approach used elsewhere in this codebase.
export async function getAgentConfirmationKpis(agentId: string, sinceDays = 30): Promise<ConfirmationKpis> {
  const supabase = await createClient();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: orders, error: ordersError } = await supabase.from("orders").select("id").eq("assigned_to", agentId).gte("ordered_at", since);
  if (ordersError) throw new Error(ordersError.message);

  const orderIds = (orders ?? []).map((o) => o.id);
  if (orderIds.length === 0) return calculateConfirmationKpis([], []);

  const { data: attempts, error: attemptsError } = await supabase.from("order_call_attempts").select("order_id, result").in("order_id", orderIds);
  if (attemptsError) throw new Error(attemptsError.message);

  const grouped = new Map<string, CallAttemptResult[]>();
  for (const attempt of attempts ?? []) {
    const list = grouped.get(attempt.order_id) ?? [];
    list.push(attempt.result);
    grouped.set(attempt.order_id, list);
  }

  return calculateConfirmationKpis(
    orderIds,
    Array.from(grouped.entries()).map(([orderId, results]) => ({ orderId, results })),
  );
}

// Same shape as getAgentConfirmationKpis but across every agent — the
// Confirmation section of the business dashboard, not one agent's mission page.
export async function getTeamConfirmationKpis(sinceDays = 30): Promise<ConfirmationKpis> {
  const supabase = await createClient();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: orders, error: ordersError } = await supabase.from("orders").select("id").not("assigned_to", "is", null).gte("ordered_at", since);
  if (ordersError) throw new Error(ordersError.message);

  const orderIds = (orders ?? []).map((o) => o.id);
  if (orderIds.length === 0) return calculateConfirmationKpis([], []);

  const { data: attempts, error: attemptsError } = await supabase.from("order_call_attempts").select("order_id, result").in("order_id", orderIds);
  if (attemptsError) throw new Error(attemptsError.message);

  const grouped = new Map<string, CallAttemptResult[]>();
  for (const attempt of attempts ?? []) {
    const list = grouped.get(attempt.order_id) ?? [];
    list.push(attempt.result);
    grouped.set(attempt.order_id, list);
  }

  return calculateConfirmationKpis(
    orderIds,
    Array.from(grouped.entries()).map(([orderId, results]) => ({ orderId, results })),
  );
}
