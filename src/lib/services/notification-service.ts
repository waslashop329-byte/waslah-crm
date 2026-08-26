import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationType } from "@/lib/types/database";

interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

// Internal notifications only (Part 17) — no email/WhatsApp delivery. Admin
// client: called from event subscribers and background sync/automation
// contexts with no user session, same reasoning as every other system-write
// service in this codebase.
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("notifications").insert({
    recipient_id: input.recipientId,
    type: input.type,
    title: input.title,
    message: input.message,
    related_entity_type: input.relatedEntityType ?? null,
    related_entity_id: input.relatedEntityId ?? null,
  });

  if (error) {
    console.error("Failed to create notification", { input, error });
  }
}
