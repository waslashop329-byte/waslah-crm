import "server-only";
import { createClient } from "@/lib/supabase/server";
import { calculateCustomerProfitability, type CustomerProfitability } from "@/lib/intelligence/economics/customer-profitability";
import { calculateCacBySource, type CacBySource } from "@/lib/intelligence/economics/cac";
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

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, total_amount, ad_cost, shipping_cost, order_items(quantity, unit_cost)")
    .gte("ordered_at", since);

  if (error) throw new Error(error.message);

  let revenue = 0;
  let adCost = 0;
  let shippingCost = 0;
  let cogs = 0;
  let ordersMissingCostData = 0;
  const rows = orders ?? [];

  for (const order of rows) {
    const items = (order.order_items ?? []) as Pick<OrderItemRow, "quantity" | "unit_cost">[];
    const missingCogs = items.some((item) => item.unit_cost === null);

    if (order.ad_cost === null || order.shipping_cost === null || missingCogs) {
      ordersMissingCostData += 1;
      continue;
    }

    revenue += order.total_amount;
    adCost += order.ad_cost;
    shippingCost += order.shipping_cost;
    cogs += items.reduce((sum, item) => sum + item.quantity * (item.unit_cost ?? 0), 0);
  }

  return {
    revenue: round2(revenue),
    adCost: round2(adCost),
    shippingCost: round2(shippingCost),
    cogs: round2(cogs),
    netProfit: round2(revenue - adCost - shippingCost - cogs),
    ordersConsidered: rows.length - ordersMissingCostData,
    ordersMissingCostData,
  };
}

export async function getCacBySource(days = 90): Promise<CacBySource[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, customer_since, customer_acquisition(source)")
    .is("deleted_at", null)
    .gte("customer_since", since);

  if (error) throw new Error(error.message);

  const rows = customers ?? [];
  if (rows.length === 0) return [];

  const customerIds = rows.map((c) => c.id);
  const { data: firstOrders } = await supabase
    .from("orders")
    .select("customer_id, ad_cost, ordered_at")
    .in("customer_id", customerIds)
    .order("ordered_at", { ascending: true });

  const firstAdCostByCustomer = new Map<string, number | null>();
  for (const order of firstOrders ?? []) {
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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
