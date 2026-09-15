import "server-only";
import { createClient } from "@/lib/supabase/server";
import { calculateCustomerProfitability, type CustomerProfitability } from "@/lib/intelligence/economics/customer-profitability";
import { calculateCacBySource, type CacBySource } from "@/lib/intelligence/economics/cac";
import {
  calculateRepeatPurchaseRate,
  calculateRetentionRate,
  calculateChurnRate,
  calculateBlendedCac,
  calculateLtvToCacRatio,
} from "@/lib/intelligence/economics/marketing-metrics";
import { readCount } from "@/lib/supabase/fetch-all-rows";
import type { OrderItemRow, OrderRow } from "@/lib/types/database";

type OrderWithItems = Pick<OrderRow, "id" | "total_amount" | "ad_cost" | "shipping_cost"> & { order_items: OrderItemRow[] };

export async function getCustomerProfitability(customerId: string): Promise<CustomerProfitability> {
  const supabase = await createClient();

  const [{ data: customer }, { data: orders }] = await Promise.all([
    supabase.from("customers").select("total_spend").eq("id", customerId).single(),
    supabase.from("orders").select("id, total_amount, ad_cost, shipping_cost, order_items(*)").eq("customer_id", customerId),
  ]);

  const rows = (orders ?? []) as unknown as OrderWithItems[];
  const itemsByOrderId = new Map(rows.map((order) => [order.id, order.order_items ?? []]));

  return calculateCustomerProfitability(customer?.total_spend ?? 0, rows, itemsByOrderId);
}

export interface BusinessProfitSnapshot {
  revenue: number;
  adCost: number;
  shippingCost: number;
  cogs: number;
  netProfit: number;
  ordersConsidered: number;
  ordersMissingCostData: number;
}

// Business-wide profit over a window — same "exclude, don't zero-fill,
// report the gap" approach as calculateCustomerProfitability, aggregated
// instead of per-customer.
//
// Preparing for real bulk-import volume (~700 orders/day): this used to
// page through every order in the window plus every one of their
// order_items (chunked by 200 order ids, after an earlier fix for a
// statement timeout doing it as one big join) just to sum revenue/costs in
// JavaScript. Migration 0073 moved the whole computation into one Postgres
// aggregate query — same exclusion rule (an order only counts if ad_cost,
// shipping_cost, and every line item's unit_cost are known).
export async function getBusinessProfitSnapshot(days = 30): Promise<BusinessProfitSnapshot> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase.rpc("get_business_profit_snapshot", { since }).single();
  if (error) {
    console.error("getBusinessProfitSnapshot RPC failed:", error.message);
  }

  const revenue = data?.revenue ?? 0;
  const adCost = data?.ad_cost ?? 0;
  const shippingCost = data?.shipping_cost ?? 0;
  const cogs = data?.cogs ?? 0;

  return {
    revenue: round2(revenue),
    adCost: round2(adCost),
    shippingCost: round2(shippingCost),
    cogs: round2(cogs),
    netProfit: round2(revenue - adCost - shippingCost - cogs),
    ordersConsidered: data?.orders_considered ?? 0,
    ordersMissingCostData: data?.orders_missing_cost_data ?? 0,
  };
}

// Preparing for real bulk-import volume (~700 orders/day): this used to
// fetch every customer in the window, then chunk their ids into batches of
// 200 to find each one's first order (a fix for an earlier live statement
// timeout from one huge `.in()` list), then group by source in JS.
// Migration 0074 does the "first order per customer" lookup as one
// DISTINCT ON pass over orders in Postgres — calculateCacBySource() still
// does the final per-source grouping/averaging unchanged, since that part
// (already just one row per customer, in memory) was never the bottleneck.
export async function getCacBySource(days = 90): Promise<CacBySource[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase.rpc("get_customer_acquisition_first_order_cost", { since });
  if (error) {
    console.error("getCacBySource RPC failed:", error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  // The RPC already coalesces a missing acquisition source to "untagged" —
  // the same string calculateCacBySource's own null-coalescing would
  // produce, so passing it straight through groups identically.
  return calculateCacBySource(data.map((row) => ({ source: row.source, firstOrderAdCost: row.first_order_ad_cost })));
}

export interface MarketingMetrics {
  repeatPurchaseRate: number | null;
  retentionRate30d: number | null;
  churnRate30d: number | null;
  avgLtv: number | null;
  avgCac: number | null;
  ltvToCacRatio: number | null;
}

// Phase 15 (growth roadmap) — the marketing formulas layered on top of data
// that already exists from earlier phases (customer_acquisition for CAC,
// total_spend for realized LTV). AOV already has its own dashboard KPI
// (aovLast30d in dashboard-repository.ts), so it isn't duplicated here.
// Preparing for real bulk-import volume (~700 orders/day): avgLtv used to
// page through every non-deleted customer's total_spend (fetchAllRows) just
// to average it in JS — migration 0075 does that AVG() in Postgres instead.
// The four counts below now go through readCount() so a real query error
// (a statement timeout under load, same failure mode already found twice
// this session) logs visibly instead of silently reading as 0.
export async function getMarketingMetrics(): Promise<MarketingMetrics> {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [totalCustomersResult, repeatCustomersResult, existingBeforeWindowResult, orderedInWindowResult, avgLtvResult, cacBySource] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null).gt("total_orders", 1),
    supabase.from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null).lt("customer_since", thirtyDaysAgo),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .lt("customer_since", thirtyDaysAgo)
      .gte("last_order_at", thirtyDaysAgo),
    supabase.rpc("get_average_customer_ltv"),
    getCacBySource(),
  ]);

  const totalCustomers = readCount(totalCustomersResult, "totalCustomers");
  const repeatCustomers = readCount(repeatCustomersResult, "repeatCustomers");
  const existingBeforeWindow = readCount(existingBeforeWindowResult, "existingBeforeWindow");
  const orderedInWindow = readCount(orderedInWindowResult, "orderedInWindow");

  if (avgLtvResult.error) {
    console.error("getMarketingMetrics avgLtv RPC failed:", avgLtvResult.error.message);
  }

  const retentionRate30d = calculateRetentionRate({
    customersExistingBeforeWindow: existingBeforeWindow,
    ofThoseWhoOrderedInWindow: orderedInWindow,
  });

  const avgLtv = avgLtvResult.data !== null && avgLtvResult.data !== undefined ? round2(avgLtvResult.data) : null;
  const avgCac = calculateBlendedCac(cacBySource.map((s) => ({ averageCac: s.averageCac, customersWithKnownCost: s.customersWithKnownCost })));

  return {
    repeatPurchaseRate: calculateRepeatPurchaseRate({ totalCustomers, repeatCustomers }),
    retentionRate30d,
    churnRate30d: calculateChurnRate(retentionRate30d),
    avgLtv,
    avgCac,
    ltvToCacRatio: calculateLtvToCacRatio(avgLtv, avgCac),
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
