import { z } from "zod";

// Mirrors CrmEventName (lib/events/event-types.ts) — kept as its own literal
// list rather than deriving from the TS type, since Zod needs a concrete
// runtime value and this is also exactly the set of triggers Part 10 asks for.
export const AUTOMATION_TRIGGERS = [
  "customer.created",
  "customer.updated",
  "order.created",
  "order.updated",
  "order.confirmed",
  "order.cancelled",
  "order.shipped",
  "order.delivered",
  "order.returned",
  "follow_up.created",
  "follow_up.completed",
  "customer.score_changed",
  "customer.risk_changed",
] as const;

export type AutomationTrigger = (typeof AUTOMATION_TRIGGERS)[number];

export const automationTriggerSchema = z.enum(AUTOMATION_TRIGGERS);
