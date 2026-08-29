import "server-only";
import { createMockMessagingProvider } from "@/lib/messaging/providers/mock-provider";
import { createTwilioProvider } from "@/lib/messaging/providers/twilio-provider";
import { createMetaWhatsAppProvider } from "@/lib/messaging/providers/meta-whatsapp-provider";
import type { MessagingProvider } from "@/lib/messaging/types/messaging-types";

// MESSAGING_PROVIDER switches providers by env var alone, same shape as the
// AI provider registry. Falls back to mock whenever the chosen provider's
// credentials aren't fully set, rather than throwing — every send path stays
// exercisable even with partial/missing config.
export function getMessagingProvider(): MessagingProvider {
  if (process.env.MESSAGING_PROVIDER === "twilio") {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
    if (accountSid && authToken && whatsappFrom) {
      return createTwilioProvider(accountSid, authToken, whatsappFrom, process.env.TWILIO_SMS_FROM ?? null);
    }
  }

  if (process.env.MESSAGING_PROVIDER === "meta_whatsapp") {
    const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
    if (phoneNumberId && accessToken) {
      return createMetaWhatsAppProvider(phoneNumberId, accessToken);
    }
  }

  return createMockMessagingProvider();
}

export function isUsingRealMessagingProvider(): boolean {
  return getMessagingProvider().name !== "mock";
}
