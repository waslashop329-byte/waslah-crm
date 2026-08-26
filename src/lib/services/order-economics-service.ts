import "server-only";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/services/audit-service";
import type { OrderItemRow, OrderRow } from "@/lib/types/database";

export async function updateOrderCosts(actorId: string, orderId: string, adCost: number | null, shippingCost: number | null): Promise<OrderRow> {
  const supabase = await createClient();
  const { data: before } = await supabase.from("orders").select("ad_cost, shipping_cost").eq("id", orderId).single();

  const { data: order, error } = await supabase
    .from("orders")
    .update({ ad_cost: adCost, shipping_cost: shippingCost })
    .eq("id", orderId)
    .select()
    .single();

  if (error || !order) throw new Error(error?.message ?? "Failed to update order costs");

  await recordAudit({
    actorId,
    action: "order.costs_updated",
    entityType: "order",
    entityId: orderId,
    beforeData: before ? { ad_cost: before.ad_cost, shipping_cost: before.shipping_cost } : null,
    afterData: { ad_cost: adCost, shipping_cost: shippingCost },
  });

  return order;
}

export interface OrderLineItemInput {
  productId: string | null;
  productNameRaw: string;
  quantity: number;
  unitPrice: number;
  unitCost: number | null;
}

// Replaces the whole set at once (delete-then-insert) — matches the
// "recompute, never drift" approach used elsewhere (recalculateCustomerStats,
// suggestion re-generation) rather than trying to diff individual rows.
export async function replaceOrderLineItems(actorId: string, orderId: string, items: OrderLineItemInput[]): Promise<OrderItemRow[]> {
  const supabase = await createClient();

  const { error: deleteError } = await supabase.from("order_items").delete().eq("order_id", orderId);
  if (deleteError) throw new Error(deleteError.message);

  if (items.length === 0) {
    await recordAudit({ actorId, action: "order.line_items_cleared", entityType: "order", entityId: orderId });
    return [];
  }

  const { data: inserted, error: insertError } = await supabase
    .from("order_items")
    .insert(
      items.map((item) => ({
        order_id: orderId,
        product_id: item.productId,
        product_name_raw: item.productNameRaw,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        unit_cost: item.unitCost,
      })),
    )
    .select();

  if (insertError || !inserted) throw new Error(insertError?.message ?? "Failed to save line items");

  await recordAudit({
    actorId,
    action: "order.line_items_updated",
    entityType: "order",
    entityId: orderId,
    afterData: { count: inserted.length },
  });

  return inserted;
}

export async function getOrderLineItems(orderId: string): Promise<OrderItemRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("order_items").select("*").eq("order_id", orderId).order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}
