import "server-only";
import type { MessagingProvider, SendMessageParams, SendMessageResult } from "@/lib/messaging/types/messaging-types";

// Real provider, built once real credentials existed (see registry.ts).
// Twilio's REST API directly via fetch — no SDK dependency needed for one
// endpoint. WhatsApp messages must be prefixed "whatsapp:" on both From/To
// per Twilio's API; SMS uses the bare E.164 number. The From number for
// WhatsApp is the Twilio Sandbox number until a real WhatsApp Business
// sender is approved — the customer must have joined the sandbox first
// (sent the "join <code>" message) or Twilio silently fails the send.
export function createTwilioProvider(accountSid: string, authToken: string, whatsappFrom: string, smsFrom: string | null): MessagingProvider {
  return {
    name: "twilio",

    async sendMessage({ to, channel, body }: SendMessageParams): Promise<SendMessageResult> {
      const from = channel === "whatsapp" ? `whatsapp:${whatsappFrom}` : smsFrom;
      if (!from) {
        return { success: false, providerMessageId: null, error: `No Twilio "from" number configured for channel "${channel}"` };
      }

      const toAddress = channel === "whatsapp" ? `whatsapp:${to}` : to;

      const params = new URLSearchParams({ From: from, To: toAddress, Body: body });

      try {
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        });

        const data = (await response.json()) as { sid?: string; message?: string; code?: number };

        if (!response.ok) {
          return { success: false, providerMessageId: null, error: data.message ?? `Twilio error (HTTP ${response.status})` };
        }

        return { success: true, providerMessageId: data.sid ?? null, error: null };
      } catch (error) {
        return { success: false, providerMessageId: null, error: error instanceof Error ? error.message : "Unknown error calling Twilio" };
      }
    },
  };
}
