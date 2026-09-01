import "server-only";
import { createClient } from "@/lib/supabase/server";
import { suggestUpsellProducts } from "@/lib/intelligence/sales/product-affinity";
import { calculateJourneyStages, type JourneyStage } from "@/lib/intelligence/sales/customer-journey";
import { calculateCohortRetention, type CohortRow } from "@/lib/intelligence/sales/cohort-analysis";
import { calculateReasonBreakdown, type CancellationReasonBreakdown } from "@/lib/intelligence/sales/voice-of-customer";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import type { ProductRow } from "@/lib/types/database";

export interface UpsellSuggestion {
  product: ProductRow;
  coCount: number;
}

// All-customer purchase history, needed to compute affinity for any single
// customer — fetched in full (paged past PostgREST's 1000-row cap) rather
// than building a materialized affinity table; revisit with a real
// affinity table if order volume grows enough that paging through all of
// it becomes slow, not just past the cap.
export async function getUpsellSuggestions(customerId: string, limit = 5): Promise<UpsellSuggestion[]> {
  const supabase = await createClient();

  const items = await fetchAllRows((from, to) =>
    supabase.from("order_items").select("product_id, orders!inner(customer_id)").not("product_id", "is", null).range(from, to),
  );

  const purchases = items
    .map((item) => ({
      customerId: (item.orders as unknown as { customer_id: string }).customer_id,
      productId: item.product_id as string,
    }))
    .filter((p): p is { customerId: string; productId: string } => Boolean(p.productId));

  const ownedProductIds = new Set(purchases.filter((p) => p.customerId === customerId).map((p) => p.productId));
  if (ownedProductIds.size === 0) return [];

  const suggestions = suggestUpsellProducts(purchases, ownedProductIds, limit);
  if (suggestions.length === 0) return [];

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .in("id", suggestions.map((s) => s.productId))
    .eq("is_active", true);

  const productById = new Map((products ?? []).map((p) => [p.id, p]));
  return suggestions.map((s) => ({ product: productById.get(s.productId), coCount: s.coCount })).filter((s): s is UpsellSuggestion => Boolean(s.product));
}

export async function getCustomerJourney(customerId: string): Promise<JourneyStage[]> {
  const supabase = await createClient();

  const [{ data: orders }, { data: vipTag }] = await Promise.all([
    supabase.from("orders").select("ordered_at, confirmed_at, delivered_at").eq("customer_id", customerId).order("ordered_at", { ascending: true }),
    supabase
      .from("customer_tags")
      .select("created_at, tags!inner(name)")
      .eq("customer_id", customerId)
      .eq("tags.name", "VIP")
      .is("removed_at", null)
      .maybeSingle(),
  ]);

  const rows = orders ?? [];
  const confirmedOrders = rows.filter((o) => o.confirmed_at !== null);
  const deliveredOrders = rows.filter((o) => o.delivered_at !== null);

  return calculateJourneyStages({
    firstOrderAt: rows[0]?.ordered_at ?? null,
    firstConfirmedAt: confirmedOrders[0]?.confirmed_at ?? null,
    firstDeliveredAt: deliveredOrders[0]?.delivered_at ?? null,
    secondOrderAt: rows[1]?.ordered_at ?? null,
    vipTaggedAt: (vipTag as unknown as { created_at: string } | null)?.created_at ?? null,
  });
}

export async function getCohortRetention(): Promise<CohortRow[]> {
  const supabase = await createClient();

  // Paged past PostgREST's 1000-row cap — every customer needs to be in the
  // cohort math, not just the first 1000.
  const customers = await fetchAllRows((from, to) =>
    supabase.from("customers").select("id, customer_since, orders(ordered_at)").is("deleted_at", null).range(from, to),
  );

  return calculateCohortRetention(
    customers.map((c) => ({
      customerSince: c.customer_since,
      orderDates: ((c.orders ?? []) as unknown as { ordered_at: string }[]).map((o) => o.ordered_at),
    })),
  );
}

export async function getVoiceOfCustomer(days = 90): Promise<CancellationReasonBreakdown[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Paged past PostgREST's 1000-row cap — a real 90-day cancellation volume
  // can exceed it.
  const data = await fetchAllRows((from, to) =>
    supabase.from("order_call_attempts").select("reason_category").eq("result", "cancelled").gte("attempted_at", since).range(from, to),
  );

  return calculateReasonBreakdown(data.map((row) => row.reason_category));
}
