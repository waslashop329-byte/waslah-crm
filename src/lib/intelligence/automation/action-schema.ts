import { z } from "zod";

// Action Handler pattern (Part 10): the discriminated union is the contract
// every handler in action-handlers.ts must satisfy — adding a new action
// type means adding one branch here and one entry in that file's HANDLERS
// map, never touching a growing switch statement elsewhere.
export const automationActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add_tag"), tagId: z.string().uuid() }),
  z.object({ type: z.literal("remove_tag"), tagId: z.string().uuid() }),
  z.object({
    type: z.literal("create_follow_up"),
    followUpType: z.enum(["call", "whatsapp", "general"]),
    title: z.string().trim().min(1).max(200),
    daysFromNow: z.number().min(0).max(365),
    priority: z.enum(["low", "medium", "high", "urgent"]),
  }),
  z.object({ type: z.literal("assign_employee"), employeeId: z.string().uuid() }),
  z.object({ type: z.literal("recalculate_score") }),
  z.object({
    type: z.literal("create_timeline_event"),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(500).optional(),
  }),
  z.object({
    type: z.literal("create_notification"),
    notificationType: z.enum(["high_risk_customer", "duplicate_candidate", "automation_failed", "follow_up_assigned"]),
    title: z.string().trim().min(1).max(200),
    message: z.string().trim().min(1).max(1000),
  }),
  z.object({
    type: z.literal("send_message"),
    channel: z.enum(["whatsapp", "sms"]),
    // Supports {{customer_name}} — see lib/messaging/template.ts.
    bodyTemplate: z.string().trim().min(1).max(1000),
  }),
]);

export const automationActionsSchema = z.array(automationActionSchema).min(1, "At least one action is required").max(10);

export type AutomationAction = z.infer<typeof automationActionSchema>;
export type AutomationActionType = AutomationAction["type"];

export const AUTOMATION_ACTION_TYPES: AutomationActionType[] = [
  "add_tag",
  "remove_tag",
  "create_follow_up",
  "assign_employee",
  "recalculate_score",
  "create_timeline_event",
  "create_notification",
  "send_message",
];
