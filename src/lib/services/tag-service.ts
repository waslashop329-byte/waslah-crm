import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordCustomerEvent } from "@/lib/services/timeline-service";
import { recordAudit } from "@/lib/services/audit-service";
import type { TagSource } from "@/lib/types/database";

interface AddTagInput {
  customerId: string;
  tagId: string;
  // null when a rule (automation), not a person, is adding the tag.
  actorId: string | null;
  source?: TagSource;
}

// Admin client, not RLS-scoped: this is called both from user-initiated
// server actions (a real session exists, but permission was already checked
// there via requirePermission) and from automation rule execution (Step 8,
// no session at all — the event that triggered the rule may have come from a
// webhook). Same reasoning as the audit/timeline fix earlier in this phase.
export async function addTagToCustomer(input: AddTagInput): Promise<void> {
  const supabase = createAdminClient();

  // Prevent duplicates: the partial unique index (customer_id, tag_id) where removed_at
  // is null already enforces this at the DB level, but check first for a clean error.
  const { data: existing } = await supabase
    .from("customer_tags")
    .select("id")
    .eq("customer_id", input.customerId)
    .eq("tag_id", input.tagId)
    .is("removed_at", null)
    .maybeSingle();

  if (existing) return;

  const { data: tag } = await supabase.from("tags").select("name").eq("id", input.tagId).single();

  const { error } = await supabase.from("customer_tags").insert({
    customer_id: input.customerId,
    tag_id: input.tagId,
    source: input.source ?? "manual",
    added_by: input.actorId,
  });

  if (error) {
    throw new Error(error.message);
  }

  await recordCustomerEvent({
    customerId: input.customerId,
    eventType: "tag.added",
    title: "Tag added",
    description: tag?.name ?? undefined,
    relatedEmployeeId: input.actorId,
  });

  await recordAudit({
    actorId: input.actorId,
    action: "tag.added",
    entityType: "customer",
    entityId: input.customerId,
    afterData: { tag_id: input.tagId, tag_name: tag?.name ?? null },
  });
}

interface RemoveTagInput {
  customerId: string;
  tagId: string;
  actorId: string | null;
}

export async function removeTagFromCustomer(input: RemoveTagInput): Promise<void> {
  const supabase = createAdminClient();

  const { data: tag } = await supabase.from("tags").select("name").eq("id", input.tagId).single();

  const { error } = await supabase
    .from("customer_tags")
    .update({ removed_at: new Date().toISOString() })
    .eq("customer_id", input.customerId)
    .eq("tag_id", input.tagId)
    .is("removed_at", null);

  if (error) {
    throw new Error(error.message);
  }

  await recordCustomerEvent({
    customerId: input.customerId,
    eventType: "tag.removed",
    title: "Tag removed",
    description: tag?.name ?? undefined,
    relatedEmployeeId: input.actorId,
  });

  await recordAudit({
    actorId: input.actorId,
    action: "tag.removed",
    entityType: "customer",
    entityId: input.customerId,
    beforeData: { tag_id: input.tagId, tag_name: tag?.name ?? null },
  });
}
