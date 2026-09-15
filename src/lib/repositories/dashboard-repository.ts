import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

export interface DashboardStats {
  totalCustomers: number;
  newCustomers30d: number;
  repeatCustomers: number;
  vipCustomers: number;
  highValueCustomers: number;
  excellentCustomers: number;
  trustedCustomers: number;
  atRiskCustomers: number;
  highCancellationRiskCustomers: number;
  inactiveCustomers: number;
  pendingFollowUps: number;
  overdueFollowUps: number;
  duplicateCandidates: number;
  automationSuccessRate: number | null;
}

export interface RecentActivityItem {
  id: string;
  customerId: string;
  customerName: string;
  eventType: string;
  description: string | null;
  createdAt: string;
}

// A count query that silently returns 0 instead of the real number (from a
// timeout, an RLS surprise, anything) is worse than one that's merely slow —
// it looks like a valid answer. Every count in this file now goes through
// this instead of a bare `.count ?? 0`: real errors get logged (visible in
// server logs, unlike before) rather than disappearing into a misleading
// zero. Found live: with the customer base past ~11,000, several of
// getDashboardStats' then-13 concurrent count queries started intermittently
// hitting statement timeouts under real contention — "Total Customers: 0"
// on the dashboard while the CAC table on the very same page, from a
// different query, correctly showed 11,698.
function readCount(result: { count: number | null; error: { message: string } | null }, label: string): number {
  if (result.error) {
    console.error(`Dashboard count query failed (${label}):`, result.error.message);
    return 0;
  }
  return result.count ?? 0;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgoForAutomation = thirtyDaysAgo;

  const [customerCounts, vipTagged, highValueTagged, pendingFollowUps, overdueFollowUps, duplicateCandidates] = await Promise.all([
    // 8 of the customer-table counts this used to run separately, collapsed
    // into one query (migration 0069) — the single biggest source of the
    // concurrent-query pile-up that caused the timeouts above.
    supabase.rpc("get_dashboard_customer_counts", { thirty_days_ago: thirtyDaysAgo, ninety_days_ago: ninetyDaysAgo }).single(),
    supabase
      .from("customer_tags")
      .select("customer_id, tags!inner(name)", { count: "exact", head: true })
      .eq("tags.name", "VIP")
      .is("removed_at", null),
    supabase
      .from("customer_tags")
      .select("customer_id, tags!inner(name)", { count: "exact", head: true })
      .eq("tags.name", "High Value")
      .is("removed_at", null),
    // "Overdue" is never stored — it's status='pending' whose due_date has passed.
    supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("status", "pending").gte("due_date", new Date().toISOString()),
    supabase.from("follow_ups").select("id", { count: "exact", head: true }).eq("status", "pending").lt("due_date", new Date().toISOString()),
    supabase.from("duplicate_candidates").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  if (customerCounts.error) {
    console.error("Dashboard customer-counts RPC failed:", customerCounts.error.message);
  }
  const counts = customerCounts.data;

  // Paged past PostgREST's 1000-row cap — real execution volume can exceed
  // it, and this needs every row for an accurate success rate.
  const automationRuns = await fetchAllRows<{ status: string }>((from, to) =>
    supabase.from("automation_executions").select("status").gte("started_at", thirtyDaysAgoForAutomation).in("status", ["completed", "failed"]).range(from, to),
  );
  const automationSuccessRate =
    automationRuns.length > 0 ? Math.round((automationRuns.filter((run) => run.status === "completed").length / automationRuns.length) * 100) : null;

  return {
    totalCustomers: counts?.total_customers ?? 0,
    newCustomers30d: counts?.new_customers_30d ?? 0,
    repeatCustomers: counts?.repeat_customers ?? 0,
    vipCustomers: readCount(vipTagged, "vipCustomers"),
    highValueCustomers: readCount(highValueTagged, "highValueCustomers"),
    excellentCustomers: counts?.excellent_customers ?? 0,
    trustedCustomers: counts?.trusted_customers ?? 0,
    atRiskCustomers: counts?.at_risk_customers ?? 0,
    highCancellationRiskCustomers: counts?.high_cancellation_risk_customers ?? 0,
    inactiveCustomers: counts?.inactive_customers ?? 0,
    pendingFollowUps: readCount(pendingFollowUps, "pendingFollowUps"),
    overdueFollowUps: readCount(overdueFollowUps, "overdueFollowUps"),
    duplicateCandidates: readCount(duplicateCandidates, "duplicateCandidates"),
    automationSuccessRate,
  };
}

export interface RevenueDeliveryStats {
  ordersLast30d: number;
  deliveredLast30d: number;
  revenueLast30d: number;
  aovLast30d: number;
  repeatRevenueLast30d: number;
  deliveryRate: number | null;
  returnRate: number | null;
}

// Revenue/Delivery sections of the 5-level dashboard (Part 7's admin
// dashboard breakdown). Revenue counts only delivered orders — an order that
// later cancels was never real revenue, so counting it would overstate.
export async function getRevenueDeliveryStats(days = 30): Promise<RevenueDeliveryStats> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [ordersLast30dResult, delivered, cancelledLast30dResult, returnedLast30dResult] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).gte("ordered_at", since),
    // Paged past PostgREST's 1000-row cap — a real 30-day delivered-order
    // volume can exceed it, and this needs every row to sum revenue correctly.
    fetchAllRows((from, to) => supabase.from("orders").select("total_amount, customers(total_orders)").eq("status", "delivered").gte("ordered_at", since).range(from, to)),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "cancelled").gte("ordered_at", since),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "returned").gte("ordered_at", since),
  ]);
  const ordersLast30d = readCount(ordersLast30dResult, "ordersLast30d");
  const cancelledLast30d = readCount(cancelledLast30dResult, "cancelledLast30d");
  const returnedLast30d = readCount(returnedLast30dResult, "returnedLast30d");

  const revenueLast30d = delivered.reduce((sum, o) => sum + o.total_amount, 0);
  const repeatRevenueLast30d = delivered
    .filter((o) => ((o.customers as unknown as { total_orders: number } | null)?.total_orders ?? 0) > 1)
    .reduce((sum, o) => sum + o.total_amount, 0);

  const resolvedOrders = delivered.length + cancelledLast30d + returnedLast30d;

  return {
    ordersLast30d,
    deliveredLast30d: delivered.length,
    revenueLast30d: round2(revenueLast30d),
    aovLast30d: delivered.length > 0 ? round2(revenueLast30d / delivered.length) : 0,
    repeatRevenueLast30d: round2(repeatRevenueLast30d),
    deliveryRate: resolvedOrders > 0 ? round1((delivered.length / resolvedOrders) * 100) : null,
    returnRate: delivered.length + returnedLast30d > 0 ? round1((returnedLast30d / (delivered.length + returnedLast30d)) * 100) : null,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function getRecentActivity(limit = 8): Promise<RecentActivityItem[]> {
  const supabase = await createClient();

  // Found live: this used to silently swallow errors (`if (!data) return []`
  // with no error check) — once the table grew past ~9,400 rows, a missing
  // index on created_at (fixed in migration 0067) made this specific query
  // hit a genuine Postgres statement timeout under concurrent dashboard
  // load, and the page just showed "No activity recorded yet" instead of a
  // visible failure. The index made it faster but not immune — this query
  // runs inside the dashboard's Promise.all alongside several other heavy
  // aggregate queries, so it can still occasionally get starved under
  // contention. Letting that throw would take down the *entire* dashboard
  // over one non-critical activity feed — worse than the original bug — so
  // this logs the failure (visible in server logs, unlike before) and
  // degrades to an empty feed instead of crashing the page.
  const { data, error } = await supabase
    .from("customer_events")
    .select("id, customer_id, event_type, description, created_at, customers(full_name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getRecentActivity query failed:", error.message);
    return [];
  }
  if (!data) return [];

  return data.map((event) => ({
    id: event.id,
    customerId: event.customer_id,
    customerName: (event.customers as unknown as { full_name: string } | null)?.full_name ?? "Unknown customer",
    eventType: event.event_type,
    description: event.description,
    createdAt: event.created_at,
  }));
}
