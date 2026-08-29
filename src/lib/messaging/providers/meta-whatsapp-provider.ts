import "server-only";
import type { MessagingProvider, SendMessageParams, SendMessageResult } from "@/lib/messaging/types/messaging-types";

// Real provider — Meta's WhatsApp Cloud API, the free alternative to Twilio
// (no trial-region restriction, no card required for the developer/test
// tier). SMS isn't supported here — Meta only does WhatsApp — so an SMS send
// through this provider fails explicitly rather than silently doing nothing.
export function createMetaWhatsAppProvider(phoneNumberId: string, accessToken: string): MessagingProvider {
  return {
    name: "meta_whatsapp",

    async sendMessage({ to, channel, body }: SendMessageParams): Promise<SendMessageResult> {
      if (channel !== "whatsapp") {
        return { success: false, providerMessageId: null, error: "Meta's WhatsApp Cloud API only supports the whatsapp channel, not sms" };
      }

      // Meta wants the number without a leading "+".
      const recipient = to.replace(/^\+/, "");

      try {
        const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: recipient,
            type: "text",
            text: { body },
          }),
        });

        const data = (await response.json()) as { messages?: { id: string }[]; error?: { message: string } };

        if (!response.ok) {
          return { success: false, providerMessageId: null, error: data.error?.message ?? `Meta API error (HTTP ${response.status})` };
        }

        return { success: true, providerMessageId: data.messages?.[0]?.id ?? null, error: null };
      } catch (error) {
        return { success: false, providerMessageId: null, error: error instanceof Error ? error.message : "Unknown error calling Meta's WhatsApp API" };
      }
    },
  };
}
