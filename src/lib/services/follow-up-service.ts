import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordCustomerEvent } from "@/lib/services/timeline-service";
import { recordAudit } from "@/lib/services/audit-service";
import { dispatchEvent } from "@/lib/events/dispatcher";
import { createNotification } from "@/lib/services/notification-service";
import type { FollowUpPriority, FollowUpRow, FollowUpType } from "@/lib/types/database";

interface CreateFollowUpInput {
  customerId: string;
  // null when a rule (automation), not a person, is creating the follow-up.
  actorId: string | null;
  type: FollowUpType;
  title: string;
  notes?: string | null;
  dueDate: string;
  priority: FollowUpPriority;
  assignedTo?: string | null;
}

// Admin client, not RLS-scoped — same reasoning as tag-service.ts: called
// from both user-initiated server actions (already permission-checked) and
// automation rule execution (Step 8, no session).
export async function createFollowUp(input: CreateFollowUpInput): Promise<FollowUpRow> {
  const supabase = createAdminClient();

  const { data: followUp, error } = await supabase
    .from("follow_ups")
    .insert({
      customer_id: input.customerId,
      assigned_to: input.assignedTo ?? input.actorId,
      type: input.type,
      title: input.title,
      due_date: input.dueDate,
      priority: input.priority,
      status: "pending",
      notes: input.notes ?? null,
      created_by: input.actorId,
      completed_by: null,
      completed_at: null,
    })
    .select()
    .single();

  if (error || !followUp) {
    throw new Error(error?.message ?? "Failed to create follow-up");
  }

  await recordCustomerEvent({
    customerId: input.customerId,
    eventType: "follow_up.created",
    title: "Follow-up created",
    description: input.title,
    relatedEmployeeId: input.actorId,
  });

  await recordAudit({
    actorId: input.actorId,
    action: "follow_up.created",
    entityType: "follow_up",
    entityId: followUp.id,
    afterData: { title: followUp.title, due_date: followUp.due_date, type: followUp.type },
  });

  await dispatchEvent("follow_up.created", { followUpId: followUp.id, customerId: input.customerId });

  // "Follow-up assigned" (Part 17) — only when it actually goes to someone
  // other than whoever created it (self-created follow-ups don't need a
  // notification telling you what you just did).
  if (followUp.assigned_to && followUp.assigned_to !== input.actorId) {
    await createNotification({
      recipientId: followUp.assigned_to,
      type: "follow_up_assigned",
      title: "Follow-up assigned to you",
      message: followUp.title,
      relatedEntityType: "follow_up",
      relatedEntityId: followUp.id,
    });
  }

  return followUp;
}

async function loadFollowUp(followUpId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("follow_ups").select("*").eq("id", followUpId).single();
  return data;
}

export async function completeFollowUp(followUpId: string, actorId: string): Promise<FollowUpRow> {
  const supabase = createAdminClient();
  const before = await loadFollowUp(followUpId);

  const { data: followUp, error } = await supabase
    .from("follow_ups")
    .update({ status: "completed", completed_by: actorId, completed_at: new Date().toISOString() })
    .eq("id", followUpId)
    .select()
    .single();

  if (error || !followUp) throw new Error(error?.message ?? "Failed to complete follow-up");

  await recordCustomerEvent({
    customerId: followUp.customer_id,
    eventType: "follow_up.completed",
    title: "Follow-up completed",
    description: followUp.title,
    relatedEmployeeId: actorId,
  });

  await recordAudit({
    actorId,
    action: "follow_up.completed",
    entityType: "follow_up",
    entityId: followUp.id,
    beforeData: before ? { status: before.status } : null,
    afterData: { status: followUp.status },
  });

  await dispatchEvent("follow_up.completed", { followUpId: followUp.id, customerId: followUp.customer_id });

  return followUp;
}

export async function cancelFollowUp(followUpId: string, actorId: string): Promise<FollowUpRow> {
  const supabase = createAdminClient();
  const before = await loadFollowUp(followUpId);

  const { data: followUp, error } = await supabase
    .from("follow_ups")
    .update({ status: "cancelled" })
    .eq("id", followUpId)
    .select()
    .single();

  if (error || !followUp) throw new Error(error?.message ?? "Failed to cancel follow-up");

  await recordAudit({
    actorId,
    action: "follow_up.cancelled",
    entityType: "follow_up",
    entityId: followUp.id,
    beforeData: before ? { status: before.status } : null,
    afterData: { status: followUp.status },
  });

  return followUp;
}

export async function rescheduleFollowUp(followUpId: string, actorId: string, dueDate: string): Promise<FollowUpRow> {
  const supabase = createAdminClient();
  const before = await loadFollowUp(followUpId);

  const { data: followUp, error } = await supabase
    .from("follow_ups")
    .update({ due_date: dueDate })
    .eq("id", followUpId)
    .select()
    .single();

  if (error || !followUp) throw new Error(error?.message ?? "Failed to reschedule follow-up");

  await recordAudit({
    actorId,
    action: "follow_up.rescheduled",
    entityType: "follow_up",
    entityId: followUp.id,
    beforeData: before ? { due_date: before.due_date } : null,
    afterData: { due_date: followUp.due_date },
  });

  return followUp;
}

export async function reassignFollowUp(followUpId: string, actorId: string, newAssigneeId: string): Promise<FollowUpRow> {
  const supabase = createAdminClient();
  const before = await loadFollowUp(followUpId);

  const { data: followUp, error } = await supabase
    .from("follow_ups")
    .update({ assigned_to: newAssigneeId })
    .eq("id", followUpId)
    .select()
    .single();

  if (error || !followUp) throw new Error(error?.message ?? "Failed to reassign follow-up");

  await recordAudit({
    actorId,
    action: "follow_up.reassigned",
    entityType: "follow_up",
    entityId: followUp.id,
    beforeData: before ? { assigned_to: before.assigned_to } : null,
    afterData: { assigned_to: followUp.assigned_to },
  });

  if (followUp.assigned_to && followUp.assigned_to !== actorId) {
    await createNotification({
      recipientId: followUp.assigned_to,
      type: "follow_up_assigned",
      title: "Follow-up assigned to you",
      message: followUp.title,
      relatedEntityType: "follow_up",
      relatedEntityId: followUp.id,
    });
  }

  return followUp;
}
