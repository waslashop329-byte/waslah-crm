import { calculateOrderProfit } from "@/lib/intelligence/economics/order-profit";
import type { OrderItemRow, OrderRow } from "@/lib/types/database";

export interface CustomerProfitability {
  realizedLtv: number;
  netProfit: number;
  /** Orders in the set whose profit couldn't be computed (missing ad/shipping/COGS cost). */
  ordersMissingCostData: number;
  totalOrders: number;
}

// Realized LTV is total_spend, already tracked on the customer row — this
// function only adds the profit side, and only ever sums orders whose costs
// are fully known (an order with an unknown cost is excluded from netProfit,
// not silently counted as zero-cost) — the ordersMissingCostData count makes
// that exclusion visible instead of presenting a partial number as complete.
export function calculateCustomerProfitability(
  realizedLtv: number,
  orders: Pick<OrderRow, "id" | "total_amount" | "ad_cost" | "shipping_cost">[],
  itemsByOrderId: Map<string, Pick<OrderItemRow, "quantity" | "unit_cost">[]>,
): CustomerProfitability {
  let netProfit = 0;
  let ordersMissingCostData = 0;

  for (const order of orders) {
    const profit = calculateOrderProfit(order, itemsByOrderId.get(order.id) ?? []);
    if (profit.netProfit === null) {
      ordersMissingCostData += 1;
    } else {
      netProfit += profit.netProfit;
    }
  }

  return { realizedLtv, netProfit, ordersMissingCostData, totalOrders: orders.length };
}
