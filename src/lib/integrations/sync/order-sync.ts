import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordCustomerEvent } from "@/lib/services/timeline-service";
import { recalculateCustomerStats } from "@/lib/integrations/sync/customer-stats";
import { dispatchEvent } from "@/lib/events/dispatcher";
import { ORDER_STATUS_EVENT } from "@/lib/events/event-types";
import { RetryableIntegrationError } from "@/lib/integrations/core/errors";
import { mapExternalProduct } from "@/lib/integrations/mappers/product-mapper";
import type { NormalizedOrder } from "@/lib/integrations/types/normalized";

export interface OrderSyncResult {
  orderId: string;
  customerId: string;
  created: boolean;
  statusChanged: boolean;
}

// Retryable: this order's customer may simply not have synced yet (e.g. a
// customer.created webhook is still in flight) — a later retry can succeed
// once that catches up, so this must not be treated as a permanent failure.
export class CustomerNotSyncedError extends RetryableIntegrationError {
  constructor(source: string, customerExternalId: string) {
    super(`No customer found for ${source}:${customerExternalId} — sync customers before orders that reference them.`);
    this.name = "CustomerNotSyncedError";
  }
}

// Idempotent: (source, external_order_id) is the unique key (Part 5). Running
// this twice with identical input creates zero new rows and zero duplicate
// timeline events — the second run finds the existing order, sees the status
// hasn't changed, and only recalculates stats (itself a pure function of the
// orders table, so recomputing twice is a no-op).
export async function syncOrder(order: NormalizedOrder): Promise<OrderSyncResult> {
  const supabase = createAdminClient();

  const { data: externalMatch } = await supabase
    .from("customer_external_ids")
    .select("customer_id")
    .eq("source", order.source)
    .eq("external_id", order.customerExternalId)
    .maybeSingle();

  if (!externalMatch) {
    throw new CustomerNotSyncedError(order.source, order.customerExternalId);
  }

  const customerId = externalMatch.customer_id;

  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id, status")
    .eq("source", order.source)
    .eq("external_order_id", order.externalId)
    .maybeSingle();

  const orderFields = {
    customer_id: customerId,
    source: order.source,
    external_order_id: order.externalId,
    external_order_code: order.displayCode ?? null,
    status: order.status,
    product_summary: order.productSummary ?? null,
    total_amount: order.totalAmount,
    ordered_at: order.orderedAt,
    confirmed_at: order.confirmedAt ?? null,
    shipped_at: order.shippedAt ?? null,
    delivered_at: order.deliveredAt ?? null,
    cancelled_at: order.cancelledAt ?? null,
    returned_at: order.returnedAt ?? null,
  };

  let orderId: string;
  let created = false;
  let statusChanged = false;

  if (!existingOrder) {
    const { data: inserted, error } = await supabase.from("orders").insert(orderFields).select("id").single();
    if (error || !inserted) throw new Error(`Failed to create order: ${error?.message ?? "unknown error"}`);

    orderId = inserted.id;
    created = true;

    await recordCustomerEvent({
      customerId,
      eventType: `order.${order.status}`,
      title: "Order created",
      description: order.productSummary ?? undefined,
      relatedOrderId: orderId,
    });

    // Only on first insert — never on a later status update, so a manually-
    // edited order_items breakdown is never clobbered by a replay of the
    // same webhook/sync run.
    if (order.lineItems && order.lineItems.length > 0) {
      // Real structured items (main_system): create one order_items row per
      // item, matching/creating the catalog product by SKU.
      for (const item of order.lineItems) {
        const productId = item.sku ? await findOrCreateProductBySku(item.sku, item.name, item.unitPrice) : null;
        const costPrice = productId ? (await supabase.from("products").select("cost_price").eq("id", productId).maybeSingle()).data?.cost_price ?? null : null;

        await supabase.from("order_items").insert({
          order_id: orderId,
          product_id: productId,
          product_name_raw: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          unit_cost: costPrice,
        });
      }
    } else if (order.productSummary) {
      // Best-effort single item from a raw text summary (mock/excel_import):
      // only ever matches an already-mapped product, never creates one —
      // free text is too ambiguous a signal to auto-create a catalog entry from.
      const productId = await mapExternalProduct(order.source, order.productSummary);
      if (productId) {
        const { data: product } = await supabase.from("products").select("cost_price").eq("id", productId).maybeSingle();
        await supabase.from("order_items").insert({
          order_id: orderId,
          product_id: productId,
          product_name_raw: order.productSummary,
          quantity: 1,
          unit_price: order.totalAmount,
          unit_cost: product?.cost_price ?? null,
        });
      }
    }
  } else {
    orderId = existingOrder.id;
    statusChanged = existingOrder.status !== order.status;

    const { error } = await supabase.from("orders").update(orderFields).eq("id", orderId);
    if (error) throw new Error(`Failed to update order: ${error.message}`);

    if (statusChanged) {
      // Guarded by the check above: replaying the same webhook/sync run with
      // an unchanged status never creates a second timeline event.
      await recordCustomerEvent({
        customerId,
        eventType: `order.${order.status}`,
        title: "Order status changed",
        description: `${existingOrder.status} → ${order.status}`,
        relatedOrderId: orderId,
      });
    }
  }

  await recalculateCustomerStats(customerId);

  // Score/risk recalculation, automation (Step 8), and any future subscriber
  // all react through the dispatcher now — this function no longer knows or
  // cares who's listening (Part 14).
  if (created) {
    await dispatchEvent("order.created", { orderId, customerId, status: order.status });
  } else if (statusChanged) {
    await dispatchEvent("order.updated", { orderId, customerId, status: order.status });
  }

  const namedStatusEvent = statusChanged || created ? ORDER_STATUS_EVENT[order.status] : undefined;
  if (namedStatusEvent) {
    await dispatchEvent(namedStatusEvent, { orderId, customerId });
  }

  return { orderId, customerId, created, statusChanged };
}

// Deliberately conservative compared to product-import-service.ts's
// upsertImportedProduct(): a real line item's price is a snapshot for
// *this order*, not a catalog price update — an existing product matched
// by SKU is only ever read here, never overwritten. Only creates a new
// catalog entry when no SKU match exists.
async function findOrCreateProductBySku(sku: string, name: string, unitPrice: number): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase.from("products").select("id").eq("sku", sku).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase.from("products").insert({ name, sku, category: null, default_price: unitPrice, cost_price: null }).select("id").single();
  if (error || !created) return null;
  return created.id;
}
