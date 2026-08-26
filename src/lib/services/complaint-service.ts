import "server-only";
import { createClient } from "@/lib/supabase/server";
import { recordCustomerEvent } from "@/lib/services/timeline-service";
import { recordAudit } from "@/lib/services/audit-service";
import type { ComplaintRow, ComplaintStatus, ComplaintType } from "@/lib/types/database";

interface CreateComplaintInput {
  customerId: string;
  orderId: string | null;
  type: ComplaintType;
  subject: string;
  description: string | null;
  actorId: string;
}

export async function createComplaint(input: CreateComplaintInput): Promise<ComplaintRow> {
  const supabase = await createClient();

  const { data: complaint, error } = await supabase
    .from("complaints")
    .insert({
      customer_id: input.customerId,
      order_id: input.orderId,
      type: input.type,
      subject: input.subject,
      description: input.description,
      created_by: input.actorId,
    })
    .select()
    .single();

  if (error || !complaint) throw new Error(error?.message ?? "Failed to create complaint");

  await recordCustomerEvent({
    customerId: input.customerId,
    eventType: "complaint.created",
    title: `${input.type.replace(/_/g, " ")} logged`,
    description: input.subject,
    relatedOrderId: input.orderId,
    relatedEmployeeId: input.actorId,
  });

  await recordAudit({ actorId: input.actorId, action: "complaint.created", entityType: "complaint", entityId: complaint.id, afterData: { type: input.type, subject: input.subject } });

  return complaint;
}

export async function updateComplaintStatus(actorId: string, complaintId: string, status: ComplaintStatus, resolutionNotes: string | null): Promise<ComplaintRow> {
  const supabase = await createClient();
  const { data: before } = await supabase.from("complaints").select("status").eq("id", complaintId).single();

  const { data: complaint, error } = await supabase
    .from("complaints")
    .update({ status, resolution_notes: resolutionNotes, resolved_at: status === "resolved" || status === "closed" ? new Date().toISOString() : null })
    .eq("id", complaintId)
    .select()
    .single();

  if (error || !complaint) throw new Error(error?.message ?? "Failed to update complaint");

  await recordAudit({
    actorId,
    action: "complaint.status_updated",
    entityType: "complaint",
    entityId: complaintId,
    beforeData: before ? { status: before.status } : null,
    afterData: { status },
  });

  return complaint;
}
