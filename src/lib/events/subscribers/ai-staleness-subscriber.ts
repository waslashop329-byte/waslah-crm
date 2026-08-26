import "server-only";
import { subscribe } from "@/lib/events/dispatcher";
import { markCustomerSummaryStale } from "@/lib/ai/services/customer-summary-service";
import type { CrmEventName } from "@/lib/events/event-types";

// Part 21's example almost verbatim: order.delivered -> mark AI summary
// stale. Deliberately does NOT call the AI here — marking stale is a cheap
// DB write; the actual (possibly slow, possibly failing) AI call only ever
// happens on-demand when someone views/refreshes the summary. An AI outage
// can never break order sync because order sync never waits on the AI.
const STALENESS_TRIGGERS: CrmEventName[] = [
  "customer.updated",
  "order.created",
  "order.updated",
  "order.confirmed",
  "order.cancelled",
  "order.shipped",
  "order.delivered",
  "order.returned",
  "customer.score_changed",
  "customer.risk_changed",
];

export function registerAiStalenessSubscriber(): void {
  for (const trigger of STALENESS_TRIGGERS) {
    subscribe(trigger, async (payload) => {
      const customerId = "customerId" in payload ? payload.customerId : undefined;
      if (!customerId) return;
      await markCustomerSummaryStale(customerId);
    });
  }
}
