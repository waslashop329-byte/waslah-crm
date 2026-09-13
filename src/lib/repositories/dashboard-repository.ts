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

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgoForAutomation = thirtyDaysAgo;

  const [
    totalCustomers,
    newCustomers30d,
    repeatCustomers,
    excellentCustomers,
    trustedCustomers,
    atRiskCustomers,
    highCancellationRiskCustomers,
    inactiveCustomers,
    vipTagged,
    highValueTagged,
    pendingFollowUps,
    overdueFollowUps,
    duplicateCandidates,
  ] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("customer_since", thirtyDaysAgo),
    supabase.from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null).gt("total_orders", 1),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("score_category", "excellent"),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("score_category", "trusted"),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("score_category", "high_risk"),
    // PostgREST has no column-to-column comparison filter — `customer_list_view`
    // precomputes this as a real boolean column (see migration 0061); this used
    // to be `.filter("cancelled_orders", "gt", "delivered_orders")` directly on
    // `customers`, which silently always returned 0 (the filter errored, and
    // `.count ?? 0` below swallowed the error).
    supabase
      .from("customer_list_view")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("cancelled_gt_delivered", true),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .or(`last_order_at.lt.${ninetyDaysAgo},last_order_at.is.null`),
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

  // Paged past PostgREST's 1000-row cap — real execution volume can exceed
  // it, and this needs every row for an accurate success rate.
  const automationRuns = await fetchAllRows<{ status: string }>((from, to) =>
    supabase.from("automation_executions").select("status").gte("started_at", thirtyDaysAgoForAutomation).in("status", ["completed", "failed"]).range(from, to),
  );
  const automationSuccessRate =
    automationRuns.length > 0 ? Math.round((automationRuns.filter((run) => run.status === "completed").length / automationRuns.length) * 100) : null;

  return {
    totalCustomers: totalCustomers.count ?? 0,
    newCustomers30d: newCustomers30d.count ?? 0,
    repeatCustomers: repeatCustomers.count ?? 0,
    vipCustomers: vipTagged.count ?? 0,
    highValueCustomers: highValueTagged.count ?? 0,
    excellentCustomers: excellentCustomers.count ?? 0,
    trustedCustomers: trustedCustomers.count ?? 0,
    atRiskCustomers: atRiskCustomers.count ?? 0,
    highCancellationRiskCustomers: highCancellationRiskCustomers.count ?? 0,
    inactiveCustomers: inactiveCustomers.count ?? 0,
    pendingFollowUps: pendingFollowUps.count ?? 0,
    overdueFollowUps: overdueFollowUps.count ?? 0,
    duplicateCandidates: duplicateCandidates.count ?? 0,
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

  const [{ count: ordersLast30d }, delivered, { count: cancelledLast30d }, { count: returnedLast30d }] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).gte("ordered_at", since),
    // Paged past PostgREST's 1000-row cap — a real 30-day delivered-order
    // volume can exceed it, and this needs every row to sum revenue correctly.
    fetchAllRows((from, to) => supabase.from("orders").select("total_amount, customers(total_orders)").eq("status", "delivered").gte("ordered_at", since).range(from, to)),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "cancelled").gte("ordered_at", since),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "returned").gte("ordered_at", since),
  ]);
  const revenueLast30d = delivered.reduce((sum, o) => sum + o.total_amount, 0);
  const repeatRevenueLast30d = delivered
    .filter((o) => ((o.customers as unknown as { total_orders: number } | null)?.total_orders ?? 0) > 1)
    .reduce((sum, o) => sum + o.total_amount, 0);

  const resolvedOrders = delivered.length + (cancelledLast30d ?? 0) + (returnedLast30d ?? 0);

  return {
    ordersLast30d: ordersLast30d ?? 0,
    deliveredLast30d: delivered.length,
    revenueLast30d: round2(revenueLast30d),
    aovLast30d: delivered.length > 0 ? round2(revenueLast30d / delivered.length) : 0,
    repeatRevenueLast30d: round2(repeatRevenueLast30d),
    deliveryRate: resolvedOrders > 0 ? round1((delivered.length / resolvedOrders) * 100) : null,
    returnRate: delivered.length + (returnedLast30d ?? 0) > 0 ? round1(((returnedLast30d ?? 0) / (delivered.length + (returnedLast30d ?? 0))) * 100) : null,
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
