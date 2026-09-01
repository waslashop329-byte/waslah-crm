import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

// Part 9: pre-aggregated metrics only — the AI never sees raw customer rows
// here, just numbers already computed by SQL/services. This keeps the
// context small and means the AI is finding patterns in a summary a human
// could also read, not silently digesting thousands of rows unchecked.
export interface BusinessMetricsSnapshot {
  totals: { customers: number; ordersLast30d: number; cancelledLast30d: number; deliveredLast30d: number };
  cancellationRate: { last30d: number; previous30d: number };
  churn: { inactive90d: number };
  repeatPurchase: { repeatCustomers: number; singleOrderCustomers: number };
  highValue: { customerCount: number; averageSpend: number };
  riskDistribution: { low: number; medium: number; high: number };
  followUps: { completedLast30d: number; overdueNow: number; completionRate: number | null };
  automation: { executionsLast30d: number; successRateLast30d: number | null };
}

export async function buildBusinessMetricsSnapshot(): Promise<BusinessMetricsSnapshot> {
  const supabase = createAdminClient();
  const now = Date.now();
  const d = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalCustomers,
    ordersLast30d,
    cancelledLast30d,
    deliveredLast30d,
    cancelledPrev30d,
    ordersPrev30d,
    inactive90d,
    repeatCustomers,
    singleOrderCustomers,
    highValueTagged,
    riskLow,
    riskMedium,
    riskHigh,
    followUpsCompleted30d,
    followUpsOverdue,
    followUpsTotal30d,
  ] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("orders").select("id", { count: "exact", head: true }).gte("ordered_at", d(30)),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "cancelled").gte("ordered_at", d(30)),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "delivered").gte("ordered_at", d(30)),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "cancelled").gte("ordered_at", d(60)).lt("ordered_at", d(30)),
    supabase.from("orders").select("id", { count: "exact", head: true }).gte("ordered_at", d(60)).lt("ordered_at", d(30)),
    supabase.from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null).or(`last_order_at.lt.${d(90)},last_order_at.is.null`),
    supabase.from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null).gt("total_orders", 1),
    supabase.from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("total_orders", 1),
    supabase.from("customer_tags").select("customer_id, tags!inner(name)", { count: "exact", head: true }).eq("tags.name", "High Value").is("removed_at", null),
    supabase.from("customer_risk_profiles").select("customer_id", { count: "exact", head: true }).eq("overall_risk_category", "low"),
    supabase.from("customer_risk_profiles").select("customer_id", { count: "exact", head: true }).eq("overall_risk_category", "medium"),
    supabase.from("customer_risk_profiles").select("customer_id", { count: "exact", head: true }).eq("overall_risk_category", "high"),
    supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", d(30)),
    supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("status", "pending").lt("due_date", new Date().toISOString()),
    supabase.from("follow_ups").select("id", { count: "exact", head: true }).gte("created_at", d(30)),
  ]);

  // Both paged past PostgREST's 1000-row cap — real customer/execution
  // volume can exceed it, and averaging/success-rate math needs every row.
  const [highValueCustomers, automationRuns] = await Promise.all([
    fetchAllRows<{ total_spend: number }>((from, to) => supabase.from("customers").select("total_spend").is("deleted_at", null).gt("total_spend", 0).range(from, to)),
    fetchAllRows<{ status: string }>((from, to) =>
      supabase.from("automation_executions").select("status").gte("started_at", d(30)).in("status", ["completed", "failed"]).range(from, to),
    ),
  ]);
  const averageSpend = highValueCustomers.length > 0 ? highValueCustomers.reduce((sum, c) => sum + c.total_spend, 0) / highValueCustomers.length : 0;

  const automationSuccessRate = automationRuns.length > 0 ? automationRuns.filter((r) => r.status === "completed").length / automationRuns.length : null;

  const ordersLast30dCount = ordersLast30d.count ?? 0;
  const cancelledLast30dCount = cancelledLast30d.count ?? 0;
  const ordersPrev30dCount = ordersPrev30d.count ?? 0;
  const cancelledPrev30dCount = cancelledPrev30d.count ?? 0;

  return {
    totals: {
      customers: totalCustomers.count ?? 0,
      ordersLast30d: ordersLast30dCount,
      cancelledLast30d: cancelledLast30dCount,
      deliveredLast30d: deliveredLast30d.count ?? 0,
    },
    cancellationRate: {
      last30d: ordersLast30dCount > 0 ? Math.round((cancelledLast30dCount / ordersLast30dCount) * 1000) / 10 : 0,
      previous30d: ordersPrev30dCount > 0 ? Math.round((cancelledPrev30dCount / ordersPrev30dCount) * 1000) / 10 : 0,
    },
    churn: { inactive90d: inactive90d.count ?? 0 },
    repeatPurchase: { repeatCustomers: repeatCustomers.count ?? 0, singleOrderCustomers: singleOrderCustomers.count ?? 0 },
    highValue: { customerCount: highValueTagged.count ?? 0, averageSpend: Math.round(averageSpend * 100) / 100 },
    riskDistribution: { low: riskLow.count ?? 0, medium: riskMedium.count ?? 0, high: riskHigh.count ?? 0 },
    followUps: {
      completedLast30d: followUpsCompleted30d.count ?? 0,
      overdueNow: followUpsOverdue.count ?? 0,
      completionRate: (followUpsTotal30d.count ?? 0) > 0 ? Math.round(((followUpsCompleted30d.count ?? 0) / (followUpsTotal30d.count ?? 1)) * 1000) / 10 : null,
    },
    automation: {
      executionsLast30d: automationRuns.length,
      successRateLast30d: automationSuccessRate !== null ? Math.round(automationSuccessRate * 1000) / 10 : null,
    },
  };
}
