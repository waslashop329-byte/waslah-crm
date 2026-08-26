"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { createComplaint, updateComplaintStatus } from "@/lib/services/complaint-service";

export interface ComplaintActionState {
  error?: string;
  success?: boolean;
}

const createComplaintSchema = z.object({
  customerId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  type: z.enum(["complaint", "inquiry", "product_issue", "shipping_issue", "refund_request", "replacement_request", "warranty"]),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  description: z.string().trim().max(2000).optional(),
});

export async function createComplaintAction(_prevState: ComplaintActionState, formData: FormData): Promise<ComplaintActionState> {
  const user = await requirePermission("complaints.manage");

  const parsed = createComplaintSchema.safeParse({
    customerId: formData.get("customerId"),
    orderId: formData.get("orderId") || undefined,
    type: formData.get("type"),
    subject: formData.get("subject"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await createComplaint({
      customerId: parsed.data.customerId,
      orderId: parsed.data.orderId ?? null,
      type: parsed.data.type,
      subject: parsed.data.subject,
      description: parsed.data.description ?? null,
      actorId: user.userId,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to log complaint" };
  }

  revalidatePath("/complaints");
  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: true };
}

const updateStatusSchema = z.object({
  complaintId: z.string().uuid(),
  customerId: z.string().uuid(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
  resolutionNotes: z.string().trim().max(2000).optional(),
});

export async function updateComplaintStatusAction(_prevState: ComplaintActionState, formData: FormData): Promise<ComplaintActionState> {
  const user = await requirePermission("complaints.manage");

  const parsed = updateStatusSchema.safeParse({
    complaintId: formData.get("complaintId"),
    customerId: formData.get("customerId"),
    status: formData.get("status"),
    resolutionNotes: formData.get("resolutionNotes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await updateComplaintStatus(user.userId, parsed.data.complaintId, parsed.data.status, parsed.data.resolutionNotes ?? null);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update complaint" };
  }

  revalidatePath("/complaints");
  revalidatePath(`/customers/${parsed.data.customerId}`);
  return { success: true };
}
