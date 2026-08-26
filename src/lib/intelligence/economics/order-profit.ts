import type { OrderItemRow, OrderRow } from "@/lib/types/database";

export interface OrderProfit {
  revenue: number;
  adCost: number | null;
  shippingCost: number | null;
  /** Cost of goods sold, or null if any line item's unit_cost is unknown. */
  cogs: number | null;
  /** Null whenever any input cost is unknown — a missing cost must never be treated as zero. */
  netProfit: number | null;
}

// Pure, no DB access — same reasoning as applyStatusMapping(): a missing
// cost (ad spend never entered, a product with no cost_price set) makes the
// result unknown, not zero, so a partially-costed order never displays a
// falsely optimistic profit number.
export function calculateOrderProfit(order: Pick<OrderRow, "total_amount" | "ad_cost" | "shipping_cost">, items: Pick<OrderItemRow, "quantity" | "unit_cost">[]): OrderProfit {
  const revenue = order.total_amount;
  const adCost = order.ad_cost;
  const shippingCost = order.shipping_cost;

  const cogs = items.some((item) => item.unit_cost === null) ? null : items.reduce((sum, item) => sum + item.quantity * (item.unit_cost ?? 0), 0);

  const netProfit = adCost === null || shippingCost === null || cogs === null ? null : revenue - adCost - shippingCost - cogs;

  return { revenue, adCost, shippingCost, cogs, netProfit };
}
