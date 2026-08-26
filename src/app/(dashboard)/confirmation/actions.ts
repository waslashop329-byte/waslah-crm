"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { logCallAttempt, assignOrder } from "@/lib/services/confirmation-service";

export interface ConfirmationActionState {
  error?: string;
  success?: boolean;
}

const callAttemptSchema = z.object({
  orderId: z.string().uuid(),
  result: z.enum(["no_answer", "confirmed", "cancelled", "reschedule", "invalid_number"]),
  notes: z.string().trim().max(500).optional(),
  reasonCategory: z.enum(["price", "changed_mind", "found_elsewhere", "delivery_time", "product_mismatch", "other"]).optional(),
});

export async function logCallAttemptAction(_prevState: ConfirmationActionState, formData: FormData): Promise<ConfirmationActionState> {
  const user = await requirePermission("orders.confirm");

  const parsed = callAttemptSchema.safeParse({
    orderId: formData.get("orderId"),
    result: formData.get("result"),
    notes: formData.get("notes") || undefined,
    reasonCategory: formData.get("reasonCategory") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await logCallAttempt(user.userId, parsed.data.orderId, parsed.data.result, parsed.data.notes ?? null, parsed.data.reasonCategory ?? null);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to log call attempt" };
  }

  revalidatePath("/confirmation");
  return { success: true };
}

const assignSchema = z.object({ orderId: z.string().uuid(), agentId: z.string().uuid() });

export async function assignOrderAction(_prevState: ConfirmationActionState, formData: FormData): Promise<ConfirmationActionState> {
  const user = await requirePermission("orders.assign");

  const parsed = assignSchema.safeParse({ orderId: formData.get("orderId"), agentId: formData.get("agentId") });
  if (!parsed.success) return { error: "Invalid input" };

  try {
    await assignOrder(user.userId, parsed.data.orderId, parsed.data.agentId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to assign order" };
  }

  revalidatePath("/confirmation");
  return { success: true };
}
