import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { addTagToCustomer, removeTagFromCustomer } from "@/lib/services/tag-service";
import { createFollowUp } from "@/lib/services/follow-up-service";
import { recalculateCustomerScore } from "@/lib/intelligence/scoring/scoring-service";
import { recordCustomerEvent } from "@/lib/services/timeline-service";
import { createNotification } from "@/lib/services/notification-service";
import { sendCustomerMessage } from "@/lib/services/message-service";
import { renderMessageTemplate } from "@/lib/messaging/template";
import type { AutomationAction, AutomationActionType } from "@/lib/intelligence/automation/action-schema";

export interface ActionExecutionContext {
  customerId: string;
  automationRuleId: string;
}

type ActionHandler<A extends AutomationAction> = (action: A, context: ActionExecutionContext) => Promise<void>;

// Action Handler pattern (Part 10): one entry per action type, each a
// self-contained function — never a growing if/switch chain, and each
// handler reuses the same service every human-triggered UI action already
// goes through (add_tag reuses tag-service, etc.), so an automation and a
// person clicking a button leave an identical trail.
const ACTION_HANDLERS: { [K in AutomationActionType]: ActionHandler<Extract<AutomationAction, { type: K }>> } = {
  add_tag: async (action, context) => {
    await addTagToCustomer({ customerId: context.customerId, tagId: action.tagId, actorId: null, source: "rule" });
  },

  remove_tag: async (action, context) => {
    await removeTagFromCustomer({ customerId: context.customerId, tagId: action.tagId, actorId: null });
  },

  create_follow_up: async (action, context) => {
    const dueDate = new Date(Date.now() + action.daysFromNow * 24 * 60 * 60 * 1000).toISOString();
    await createFollowUp({
      customerId: context.customerId,
      actorId: null,
      type: action.followUpType,
      title: action.title,
      dueDate,
      priority: action.priority,
    });
  },

  assign_employee: async (action, context) => {
    const supabase = createAdminClient();
    const { error } = await supabase.from("customers").update({ assigned_to: action.employeeId }).eq("id", context.customerId);
    if (error) throw new Error(`Failed to assign employee: ${error.message}`);
  },

  recalculate_score: async (_action, context) => {
    await recalculateCustomerScore(context.customerId, "automation");
  },

  create_timeline_event: async (action, context) => {
    await recordCustomerEvent({
      customerId: context.customerId,
      eventType: "automation.triggered",
      title: action.title,
      description: action.description ?? null,
    });
  },

  create_notification: async (action, context) => {
    const supabase = createAdminClient();
    const { data: customer } = await supabase.from("customers").select("assigned_to").eq("id", context.customerId).maybeSingle();
    if (!customer?.assigned_to) return; // nobody assigned to notify — not an error, just nothing to do

    await createNotification({
      recipientId: customer.assigned_to,
      type: action.notificationType,
      title: action.title,
      message: action.message,
      relatedEntityType: "customer",
      relatedEntityId: context.customerId,
    });
  },

  send_message: async (action, context) => {
    const supabase = createAdminClient();
    const { data: customer } = await supabase.from("customers").select("full_name").eq("id", context.customerId).maybeSingle();
    if (!customer) return;

    const body = renderMessageTemplate(action.bodyTemplate, { customerName: customer.full_name });
    await sendCustomerMessage(null, context.customerId, action.channel, body);
  },
};

export async function executeAction(action: AutomationAction, context: ActionExecutionContext): Promise<void> {
  const handler = ACTION_HANDLERS[action.type] as ActionHandler<AutomationAction>;
  await handler(action, context);
}
