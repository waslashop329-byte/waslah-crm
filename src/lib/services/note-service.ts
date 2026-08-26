import "server-only";
import { createClient } from "@/lib/supabase/server";
import { recordCustomerEvent } from "@/lib/services/timeline-service";
import { recordAudit } from "@/lib/services/audit-service";
import type { CustomerNoteRow } from "@/lib/types/database";

interface CreateNoteInput {
  customerId: string;
  authorId: string;
  content: string;
  relatedOrderId?: string | null;
}

export async function createNote(input: CreateNoteInput): Promise<CustomerNoteRow> {
  const supabase = await createClient();

  const { data: note, error } = await supabase
    .from("customer_notes")
    .insert({
      customer_id: input.customerId,
      author_id: input.authorId,
      content: input.content,
      related_order_id: input.relatedOrderId ?? null,
    })
    .select()
    .single();

  if (error || !note) {
    throw new Error(error?.message ?? "Failed to create note");
  }

  await recordCustomerEvent({
    customerId: input.customerId,
    eventType: "note.created",
    title: "Note added",
    description: input.content.length > 140 ? `${input.content.slice(0, 140)}…` : input.content,
    relatedEmployeeId: input.authorId,
  });

  await recordAudit({
    actorId: input.authorId,
    action: "note.created",
    entityType: "customer_note",
    entityId: note.id,
    afterData: { content: note.content, customer_id: note.customer_id },
  });

  return note;
}

interface UpdateNoteInput {
  noteId: string;
  actorId: string;
  content: string;
}

export async function updateNote(input: UpdateNoteInput): Promise<CustomerNoteRow> {
  const supabase = await createClient();

  const { data: before } = await supabase.from("customer_notes").select("*").eq("id", input.noteId).single();

  const { data: note, error } = await supabase
    .from("customer_notes")
    .update({ content: input.content })
    .eq("id", input.noteId)
    .select()
    .single();

  if (error || !note) {
    throw new Error(error?.message ?? "Failed to update note");
  }

  await recordAudit({
    actorId: input.actorId,
    action: "note.updated",
    entityType: "customer_note",
    entityId: note.id,
    beforeData: before ? { content: before.content } : null,
    afterData: { content: note.content },
  });

  return note;
}

interface DeleteNoteInput {
  noteId: string;
  actorId: string;
}

export async function deleteNote(input: DeleteNoteInput): Promise<void> {
  const supabase = await createClient();

  const { data: before } = await supabase.from("customer_notes").select("*").eq("id", input.noteId).single();

  const { error } = await supabase
    .from("customer_notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", input.noteId);

  if (error) {
    throw new Error(error.message);
  }

  await recordAudit({
    actorId: input.actorId,
    action: "note.deleted",
    entityType: "customer_note",
    entityId: input.noteId,
    beforeData: before ? { content: before.content } : null,
  });
}
