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
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
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
export async function getBusinessProfitSnapshot(days = 30): Promise<BusinessProfitSnapshot> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Pages past PostgREST's 1000-row cap — a real 30-day order volume can
  // exceed it.
  const orders = await fetchAllRows((from, to) =>
    supabase.from("orders").select("id, total_amount, ad_cost, shipping_cost").gte("ordered_at", since).range(from, to),
  );

  // The nested `order_items(quantity, unit_cost)` join used to be fetched
  // in the same query as `orders`, paginated together — that intermittently
  // hit a genuine Postgres statement timeout live (same root cause as
  // getCacBySource: a big join done as one query). Fetching order_items
  // separately, chunked by order id, keeps every query small like the
  // getCacBySource fix does.
  const CHUNK_SIZE = 200;
  const orderIds = orders.map((o) => o.id);
  const idChunks: string[][] = [];
  for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) idChunks.push(orderIds.slice(i, i + CHUNK_SIZE));

  const itemsByChunk =
    idChunks.length === 0
      ? []
      : await Promise.all(
          idChunks.map((chunk) =>
            fetchAllRows((from, to) => supabase.from("order_items").select("order_id, quantity, unit_cost").in("order_id", chunk).range(from, to)),
          ),
        );
  const items = itemsByChunk.flat() as unknown as Pick<OrderItemRow, "order_id" | "quantity" | "unit_cost">[];

  const itemsByOrderId = new Map<string, Pick<OrderItemRow, "quantity" | "unit_cost">[]>();
  for (const item of items) {
    const arr = itemsByOrderId.get(item.order_id) ?? [];
    arr.push({ quantity: item.quantity, unit_cost: item.unit_cost });
    itemsByOrderId.set(item.order_id, arr);
  }

  let revenue = 0;
  let adCost = 0;
  let shippingCost = 0;
  let cogs = 0;
  let ordersMissingCostData = 0;

  for (const order of orders) {
    const orderItems = itemsByOrderId.get(order.id) ?? [];
    const missingCogs = orderItems.some((item) => item.unit_cost === null);

    if (order.ad_cost === null || order.shipping_cost === null || missingCogs) {
      ordersMissingCostData += 1;
      continue;
    }

    revenue += order.total_amount;
    adCost += order.ad_cost;
    shippingCost += order.shipping_cost;
    cogs += orderItems.reduce((sum, item) => sum + item.quantity * (item.unit_cost ?? 0), 0);
  }

  return {
    revenue: round2(revenue),
    adCost: round2(adCost),
    shippingCost: round2(shippingCost),
    cogs: round2(cogs),
    netProfit: round2(revenue - adCost - shippingCost - cogs),
    ordersConsidered: orders.length - ordersMissingCostData,
    ordersMissingCostData,
  };
}

export async function getCacBySource(days = 90): Promise<CacBySource[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Pages past PostgREST's 1000-row cap — a real 90-day acquisition window
  // can exceed it.
  const rows = await fetchAllRows((from, to) =>
    supabase.from("customers").select("id, customer_since, customer_acquisition(source)").is("deleted_at", null).gte("customer_since", since).range(from, to),
  );
  if (rows.length === 0) return [];

  // A single .in() with a huge id list is what actually broke this live —
  // ~1800 real customer UUIDs in one WHERE IN produced a genuine Postgres
  // "statement timeout" (confirmed against the real synced data, not
  // theoretical). Chunking the id list keeps every individual query small
  // and fast regardless of how large the cohort gets; fetchAllRows still
  // handles the per-chunk 1000-row cap on top of that.
  const CHUNK_SIZE = 200;
  const customerIds = rows.map((c) => c.id);
  const idChunks: string[][] = [];
  for (let i = 0; i < customerIds.length; i += CHUNK_SIZE) idChunks.push(customerIds.slice(i, i + CHUNK_SIZE));

  const firstOrdersByChunk = await Promise.all(
    idChunks.map((chunk) =>
      fetchAllRows((from, to) =>
        supabase.from("orders").select("customer_id, ad_cost, ordered_at").in("customer_id", chunk).order("ordered_at", { ascending: true }).range(from, to),
      ),
    ),
  );
  const firstOrders = firstOrdersByChunk.flat();

  const firstAdCostByCustomer = new Map<string, number | null>();
  for (const order of firstOrders) {
    if (!firstAdCostByCustomer.has(order.customer_id)) {
      firstAdCostByCustomer.set(order.customer_id, order.ad_cost);
    }
  }

  return calculateCacBySource(
    rows.map((c) => ({
      source: (c.customer_acquisition as unknown as { source: string | null } | null)?.source ?? null,
      firstOrderAdCost: firstAdCostByCustomer.get(c.id) ?? null,
    })),
  );
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
export async function getMarketingMetrics(): Promise<MarketingMetrics> {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: totalCustomers }, { count: repeatCustomers }, { count: existingBeforeWindow }, { count: orderedInWindow }, spendRows, cacBySource] =
    await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null).gt("total_orders", 1),
      supabase.from("customers").select("id", { count: "exact", head: true }).is("deleted_at", null).lt("customer_since", thirtyDaysAgo),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .lt("customer_since", thirtyDaysAgo)
        .gte("last_order_at", thirtyDaysAgo),
      // Paged past PostgREST's 1000-row cap — averaging total_spend across
      // only the first 1000 of a much larger real customer base silently
      // understated avg. LTV (found live, first real sync: 1817 customers).
      fetchAllRows<{ total_spend: number }>((from, to) => supabase.from("customers").select("total_spend").is("deleted_at", null).range(from, to)),
      getCacBySource(),
    ]);

  const retentionRate30d = calculateRetentionRate({
    customersExistingBeforeWindow: existingBeforeWindow ?? 0,
    ofThoseWhoOrderedInWindow: orderedInWindow ?? 0,
  });

  const avgLtv = spendRows.length > 0 ? round2(spendRows.reduce((sum, c) => sum + c.total_spend, 0) / spendRows.length) : null;
  const avgCac = calculateBlendedCac(cacBySource.map((s) => ({ averageCac: s.averageCac, customersWithKnownCost: s.customersWithKnownCost })));

  return {
    repeatPurchaseRate: calculateRepeatPurchaseRate({ totalCustomers: totalCustomers ?? 0, repeatCustomers: repeatCustomers ?? 0 }),
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
