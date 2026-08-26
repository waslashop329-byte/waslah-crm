import "server-only";
import { subscribe } from "@/lib/events/dispatcher";
import { recalculateCustomerScore } from "@/lib/intelligence/scoring/scoring-service";
import { recalculateCustomerRisk } from "@/lib/intelligence/risk/risk-service";

// Subscribes to the two events that are *always* dispatched whenever a
// customer's order-derived stats change (order.created / order.updated /
// customer.updated), rather than every specific order.<status> event — that
// way score/risk recalculation never depends on the spec's named-event list
// staying in sync with every possible order status.
export function registerScoreRiskSubscriber(): void {
  subscribe("order.created", async ({ customerId, status }) => {
    await recalculateCustomerScore(customerId, `order.${status}`);
    await recalculateCustomerRisk(customerId);
  });

  subscribe("order.updated", async ({ customerId, status }) => {
    await recalculateCustomerScore(customerId, `order.${status}`);
    await recalculateCustomerRisk(customerId);
  });

  subscribe("customer.updated", async ({ customerId }) => {
    await recalculateCustomerScore(customerId, "customer.updated");
    await recalculateCustomerRisk(customerId);
  });
}
