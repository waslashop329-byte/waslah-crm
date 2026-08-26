// The fixed vocabulary of CRM events (Part 14). Anything downstream — score,
// risk, segments (live-queried, no subscriber needed), automation (Step 8),
// timeline, future AI hooks — reacts to these instead of being called
// directly by whatever code happened to cause the change.
export interface CrmEventPayloads {
  "customer.created": { customerId: string };
  "customer.updated": { customerId: string };
  "order.created": { orderId: string; customerId: string; status: string };
  "order.updated": { orderId: string; customerId: string; status: string };
  "order.confirmed": { orderId: string; customerId: string };
  "order.cancelled": { orderId: string; customerId: string };
  "order.shipped": { orderId: string; customerId: string };
  "order.delivered": { orderId: string; customerId: string };
  "order.returned": { orderId: string; customerId: string };
  "follow_up.created": { followUpId: string; customerId: string };
  "follow_up.completed": { followUpId: string; customerId: string };
  "customer.score_changed": { customerId: string; previousScore: number; newScore: number };
  "customer.risk_changed": { customerId: string };
  "customer.merged": { primaryCustomerId: string; secondaryCustomerId: string };
}

export type CrmEventName = keyof CrmEventPayloads;

// order.status -> the specific named event, for the subset of statuses the
// spec calls out by name. Statuses outside this map (new/pending/processing/
// failed_delivery) still recalculate score/risk via order.created/updated —
// they just don't get a dedicated named event for automation rules to key off.
export const ORDER_STATUS_EVENT: Partial<Record<string, CrmEventName>> = {
  confirmed: "order.confirmed",
  cancelled: "order.cancelled",
  shipped: "order.shipped",
  delivered: "order.delivered",
  returned: "order.returned",
};
