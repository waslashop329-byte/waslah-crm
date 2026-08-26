"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { createNote } from "@/lib/services/note-service";
import { addTagToCustomer } from "@/lib/services/tag-service";
import { createFollowUp } from "@/lib/services/follow-up-service";
import { sendCustomerMessage } from "@/lib/services/message-service";
import { createNoteSchema, tagActionSchema, createFollowUpSchema, sendMessageSchema } from "@/lib/validation/customer-schemas";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

export async function createNoteAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("notes.create");

  const parsed = createNoteSchema.safeParse({
    customerId: formData.get("customerId"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createNote({ customerId: parsed.data.customerId, authorId: user.userId, content: parsed.data.content });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to add note" };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: true };
}

export async function addTagAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("tags.manage");

  const parsed = tagActionSchema.safeParse({
    customerId: formData.get("customerId"),
    tagId: formData.get("tagId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await addTagToCustomer({ customerId: parsed.data.customerId, tagId: parsed.data.tagId, actorId: user.userId });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to add tag" };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: true };
}

export async function sendMessageAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("communications.send");

  const parsed = sendMessageSchema.safeParse({
    customerId: formData.get("customerId"),
    channel: formData.get("channel"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const result = await sendCustomerMessage(user.userId, parsed.data.customerId, parsed.data.channel, parsed.data.body);
    if (!result.success) return { error: "Message provider reported a failure — check the customer's timeline for details." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to send message" };
  }

  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: true };
}

export async function createFollowUpAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("follow_ups.create");

  const parsed = createFollowUpSchema.safeParse({
    customerId: formData.get("customerId"),
    type: formData.get("type"),
    title: formData.get("title"),
    notes: formData.get("notes") ?? "",
    dueDate: formData.get("dueDate"),
    priority: formData.get("priority"),
    assignedTo: formData.get("assignedTo") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await createFollowUp({
      customerId: parsed.data.customerId,
      actorId: user.userId,
      type: parsed.data.type,
      title: parsed.data.title,
      notes: parsed.data.notes || null,
      dueDate: new Date(parsed.data.dueDate).toISOString(),
      priority: parsed.data.priority,
      assignedTo: parsed.data.assignedTo || null,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create follow-up" };
  }

  revalidatePath("/customers");
  revalidatePath("/follow-ups");
  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: true };
}
