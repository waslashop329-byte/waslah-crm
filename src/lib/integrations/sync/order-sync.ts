import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordCustomerEvent } from "@/lib/services/timeline-service";
import { recalculateCustomerStats } from "@/lib/integrations/sync/customer-stats";
import { dispatchEvent } from "@/lib/events/dispatcher";
import { ORDER_STATUS_EVENT } from "@/lib/events/event-types";
import { RetryableIntegrationError } from "@/lib/integrations/core/errors";
import { mapExternalProduct } from "@/lib/integrations/mappers/product-mapper";
import { createNote } from "@/lib/services/note-service";
import type { NormalizedOrder, NormalizedOrderStatus } from "@/lib/integrations/types/normalized";

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

// Same reasoning as CustomerNotSyncedError: a status-only webhook (e.g.
// EasyOrders' "Order Status Change", which carries no total/customer/date
// fields — only order_id + old/new status) can arrive before, or racing,
// the "Order Created" webhook for the same order. Retryable so it resolves
// itself once that one lands.
export class OrderNotSyncedError extends RetryableIntegrationError {
  constructor(source: string, externalOrderId: string) {
    super(`No order found for ${source}:${externalOrderId} — the order-created event may not have arrived yet.`);
    this.name = "OrderNotSyncedError";
  }
}

// Idempotent: (source, external_order_id) is the unique key (Part 5). Running
// this twice with identical input creates zero new rows and zero duplicate
// timeline events — the second run finds the existing order, sees the status
// hasn't changed, and only recalculates stats (itself a pure function of the
// orders table, so recomputing twice is a no-op).
// actorId is only ever supplied by the Excel-import path (a real logged-in
// user submitting the import) — sync-runner.ts's API-driven syncs have no
// human actor and never pass one, which is fine because order.note is only
// ever set by the import mapper too; the two only ever appear together.
export async function syncOrder(order: NormalizedOrder, actorId?: string | null): Promise<OrderSyncResult> {
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
    // shipping_cost is insert-only, same reasoning as customerSince: a real
    // figure from the source shouldn't silently overwrite one an admin
    // already corrected by hand on the Orders tab during a later re-sync.
    const insertOnlyFields = order.shippingCost !== undefined && order.shippingCost !== null ? { shipping_cost: order.shippingCost } : {};
    const { data: inserted, error } = await supabase.from("orders").insert({ ...orderFields, ...insertOnlyFields }).select("id").single();
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

    // Only on first insert, same as the line-items block above — a replay of
    // the same import never creates a duplicate note. Requires a real actor
    // (customer_notes.author_id is not-null); API-driven syncs never set
    // order.note, so this only ever fires from the Excel-import path, which
    // always has a logged-in user behind it.
    if (order.note && actorId) {
      await createNote({ customerId, authorId: actorId, content: order.note, relatedOrderId: orderId });
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

interface OrderStatusUpdate {
  status: NormalizedOrderStatus;
  confirmed_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  cancelled_at?: string;
  returned_at?: string;
}

const STATUS_TIMESTAMP_FIELD: Partial<Record<NormalizedOrderStatus, Exclude<keyof OrderStatusUpdate, "status">>> = {
  confirmed: "confirmed_at",
  shipped: "shipped_at",
  delivered: "delivered_at",
  cancelled: "cancelled_at",
  returned: "returned_at",
};

// For sources whose status-change webhook carries only order_id + old/new
// status (EasyOrders' "Order Status Change" event has no total/customer/date
// fields at all) — updating via the full syncOrder() upsert would require
// inventing values for every other required NormalizedOrder field, which
// would silently overwrite the order's real total_amount/ordered_at with
// garbage on every status change. This only ever touches status + the
// matching terminal timestamp, and no-ops if the status didn't actually
// change (same idempotency guarantee as syncOrder's own update branch).
export async function updateOrderStatus(source: string, externalOrderId: string, newStatus: NormalizedOrderStatus): Promise<OrderSyncResult> {
  const supabase = createAdminClient();

  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id, customer_id, status")
    .eq("source", source)
    .eq("external_order_id", externalOrderId)
    .maybeSingle();

  if (!existingOrder) {
    throw new OrderNotSyncedError(source, externalOrderId);
  }

  const { id: orderId, customer_id: customerId, status: oldStatus } = existingOrder;
  const statusChanged = oldStatus !== newStatus;

  if (statusChanged) {
    const timestampField = STATUS_TIMESTAMP_FIELD[newStatus];
    const update: OrderStatusUpdate = { status: newStatus };
    if (timestampField) update[timestampField] = new Date().toISOString();

    const { error } = await supabase.from("orders").update(update).eq("id", orderId);
    if (error) throw new Error(`Failed to update order status: ${error.message}`);

    await recordCustomerEvent({
      customerId,
      eventType: `order.${newStatus}`,
      title: "Order status changed",
      description: `${oldStatus} → ${newStatus}`,
      relatedOrderId: orderId,
    });

    await recalculateCustomerStats(customerId);
    await dispatchEvent("order.updated", { orderId, customerId, status: newStatus });

    const namedStatusEvent = ORDER_STATUS_EVENT[newStatus];
    if (namedStatusEvent) {
      await dispatchEvent(namedStatusEvent, { orderId, customerId });
    }
  }

  return { orderId, customerId, created: false, statusChanged };
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
