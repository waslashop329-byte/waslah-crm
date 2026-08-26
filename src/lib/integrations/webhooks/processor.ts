import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/integrations/core/registry";
import { validateNormalizedCustomer, validateNormalizedOrder } from "@/lib/integrations/types/schemas";
import { syncCustomer } from "@/lib/integrations/sync/customer-sync";
import { syncOrder } from "@/lib/integrations/sync/order-sync";
import { NonRetryableIntegrationError, isRetryable } from "@/lib/integrations/core/errors";
import { computeNextRetryAt } from "@/lib/integrations/webhooks/retry";

export interface ProcessResult {
  status: "processed" | "failed";
  error?: string;
  retryable?: boolean;
}

// Called right after a webhook is stored (inline, same request) and also
// reusable for manual/automatic retries — both paths go through the exact
// same logic, so there's only one place that knows how to turn a stored
// webhook_events row into a customer/order sync.
export async function processWebhookEvent(eventId: string): Promise<ProcessResult> {
  const supabase = createAdminClient();

  const { data: event } = await supabase.from("webhook_events").select("*").eq("id", eventId).single();
  if (!event) return { status: "failed", error: "Event not found" };

  await supabase.from("webhook_events").update({ status: "processing" }).eq("id", eventId);

  try {
    const provider = getProvider(event.source);

    if (event.event_type.startsWith("order.")) {
      if (!provider.normalizeOrder) throw new NonRetryableIntegrationError(`Provider "${event.source}" cannot normalize orders`);
      const normalized = await provider.normalizeOrder(event.payload);
      const validated = validateNormalizedOrder(normalized);
      if (!validated.success) throw new NonRetryableIntegrationError(validated.error);
      await syncOrder(validated.data);
    } else if (event.event_type.startsWith("customer.")) {
      if (!provider.normalizeCustomer) throw new NonRetryableIntegrationError(`Provider "${event.source}" cannot normalize customers`);
      const normalized = await provider.normalizeCustomer(event.payload);
      const validated = validateNormalizedCustomer(normalized);
      if (!validated.success) throw new NonRetryableIntegrationError(validated.error);
      await syncCustomer(validated.data);
    } else {
      throw new NonRetryableIntegrationError(`Unhandled event type: "${event.event_type}"`);
    }

    await supabase
      .from("webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString(), error: null, next_retry_at: null })
      .eq("id", eventId);

    return { status: "processed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const retryable = isRetryable(error);
    const nextRetryCount = event.retry_count + 1;

    await supabase
      .from("webhook_events")
      .update({
        status: "failed",
        error: message,
        retry_count: nextRetryCount,
        next_retry_at: retryable ? computeNextRetryAt(nextRetryCount) : null,
      })
      .eq("id", eventId);

    return { status: "failed", error: message, retryable };
  }
}
