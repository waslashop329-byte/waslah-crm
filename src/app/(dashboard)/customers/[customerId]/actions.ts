"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, requireUser } from "@/lib/auth/permissions";
import { deleteNote } from "@/lib/services/note-service";
import { completeFollowUp, cancelFollowUp } from "@/lib/services/follow-up-service";
import { recalculateCustomerScore } from "@/lib/intelligence/scoring/scoring-service";
import { recalculateCustomerRisk } from "@/lib/intelligence/risk/risk-service";
import { updateOrderCosts } from "@/lib/services/order-economics-service";
import { setCustomerAcquisition } from "@/lib/services/acquisition-service";
import { setReferrer } from "@/lib/services/loyalty-service";
import { analyzeCallNote } from "@/lib/ai/services/call-note-analysis-service";
import type { ActionState } from "@/app/(dashboard)/customers/actions";

const noteIdSchema = z.object({ noteId: z.string().uuid(), customerId: z.string().uuid() });
const followUpIdSchema = z.object({ followUpId: z.string().uuid(), customerId: z.string().uuid() });
const customerIdSchema = z.object({ customerId: z.string().uuid() });

const orderCostsSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  adCost: z.coerce.number().min(0).optional(),
  shippingCost: z.coerce.number().min(0).optional(),
});

export async function updateOrderCostsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("orders.manage_costs");

  const parsed = orderCostsSchema.safeParse({
    orderId: formData.get("orderId"),
    customerId: formData.get("customerId"),
    adCost: formData.get("adCost") || undefined,
    shippingCost: formData.get("shippingCost") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await updateOrderCosts(user.userId, parsed.data.orderId, parsed.data.adCost ?? null, parsed.data.shippingCost ?? null);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update order costs" };
  }

  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: true };
}

const acquisitionSchema = z.object({
  customerId: z.string().uuid(),
  source: z.string().trim().max(60).optional(),
  medium: z.string().trim().max(60).optional(),
  campaign: z.string().trim().max(120).optional(),
});

export async function setAcquisitionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("profit.view");

  const parsed = acquisitionSchema.safeParse({
    customerId: formData.get("customerId"),
    source: formData.get("source") || undefined,
    medium: formData.get("medium") || undefined,
    campaign: formData.get("campaign") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await setCustomerAcquisition(user.userId, parsed.data.customerId, {
      source: parsed.data.source ?? null,
      medium: parsed.data.medium ?? null,
      campaign: parsed.data.campaign ?? null,
      content: null,
      landingPage: null,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save acquisition info" };
  }

  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: true };
}

const referrerSchema = z.object({ customerId: z.string().uuid(), referredByCustomerId: z.string().uuid().optional() });

export async function setReferrerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("customers.edit");

  const parsed = referrerSchema.safeParse({
    customerId: formData.get("customerId"),
    referredByCustomerId: formData.get("referredByCustomerId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await setReferrer(user.userId, parsed.data.customerId, parsed.data.referredByCustomerId ?? null);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to set referrer" };
  }

  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: true };
}

const analyzeCallNoteSchema = z.object({ callAttemptId: z.string().uuid(), customerId: z.string().uuid() });

export async function analyzeCallNoteAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("ai.call_analysis.generate");

  const parsed = analyzeCallNoteSchema.safeParse({ callAttemptId: formData.get("callAttemptId"), customerId: formData.get("customerId") });
  if (!parsed.success) return { error: "Invalid call attempt" };

  try {
    await analyzeCallNote(parsed.data.callAttemptId, user.userId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to analyze call note" };
  }

  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: true };
}

export async function deleteNoteAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("notes.delete");

  const parsed = noteIdSchema.safeParse({ noteId: formData.get("noteId"), customerId: formData.get("customerId") });
  if (!parsed.success) return { error: "Invalid note" };

  try {
    await deleteNote({ noteId: parsed.data.noteId, actorId: user.userId });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete note" };
  }

  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: true };
}

export async function completeFollowUpAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("follow_ups.complete");

  const parsed = followUpIdSchema.safeParse({ followUpId: formData.get("followUpId"), customerId: formData.get("customerId") });
  if (!parsed.success) return { error: "Invalid follow-up" };

  try {
    await completeFollowUp(parsed.data.followUpId, user.userId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to complete follow-up" };
  }

  revalidatePath(`/customers/${parsed.data.customerId}`);
  revalidatePath("/follow-ups");
  return { success: true };
}

export async function cancelFollowUpAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("follow_ups.edit");

  const parsed = followUpIdSchema.safeParse({ followUpId: formData.get("followUpId"), customerId: formData.get("customerId") });
  if (!parsed.success) return { error: "Invalid follow-up" };

  try {
    await cancelFollowUp(parsed.data.followUpId, user.userId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to cancel follow-up" };
  }

  revalidatePath(`/customers/${parsed.data.customerId}`);
  revalidatePath("/follow-ups");
  return { success: true };
}

export async function recalculateScoreAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();

  const parsed = customerIdSchema.safeParse({ customerId: formData.get("customerId") });
  if (!parsed.success) return { error: "Invalid customer" };

  try {
    const result = await recalculateCustomerScore(parsed.data.customerId, "manual_recalculation", "Manually recalculated");
    await recalculateCustomerRisk(parsed.data.customerId);
    revalidatePath(`/customers/${parsed.data.customerId}`);
    return { success: true, message: result.changed ? `Score updated to ${result.score}` : "Score unchanged" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to recalculate score" };
  }
}
