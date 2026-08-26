import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordCustomerEvent } from "@/lib/services/timeline-service";
import { getMessagingProvider } from "@/lib/messaging/providers/registry";
import type { CommunicationRow, MessageChannel } from "@/lib/types/database";

export interface SendCustomerMessageResult {
  communication: CommunicationRow;
  success: boolean;
}

// actorId null = automation, not a person — same convention as
// createFollowUp()/addTagToCustomer(). Admin client throughout: called both
// from a human's server action (already permission-checked) and from
// action-handlers.ts with no session (Phase 4's automation engine), same
// reasoning as every other action-handler service.
export async function sendCustomerMessage(
  actorId: string | null,
  customerId: string,
  channel: MessageChannel,
  body: string,
  relatedOrderId: string | null = null,
): Promise<SendCustomerMessageResult> {
  const supabase = createAdminClient();

  const { data: phone } = await supabase.from("customer_phones").select("phone").eq("customer_id", customerId).eq("is_primary", true).maybeSingle();

  if (!phone) {
    throw new Error("Customer has no primary phone number to message");
  }

  const provider = getMessagingProvider();
  const result = await provider.sendMessage({ to: phone.phone, channel, body });

  const { data: communication, error } = await supabase
    .from("communications")
    .insert({
      customer_id: customerId,
      channel,
      body,
      status: result.success ? "sent" : "failed",
      provider: provider.name,
      provider_message_id: result.providerMessageId,
      error: result.error,
      related_order_id: relatedOrderId,
      sent_by: actorId,
    })
    .select()
    .single();

  if (error || !communication) throw new Error(error?.message ?? "Failed to log sent message");

  await recordCustomerEvent({
    customerId,
    eventType: "communication.sent",
    title: `${channel === "whatsapp" ? "WhatsApp" : "SMS"} sent`,
    description: body,
    relatedOrderId,
    relatedEmployeeId: actorId,
  });

  return { communication, success: result.success };
}
