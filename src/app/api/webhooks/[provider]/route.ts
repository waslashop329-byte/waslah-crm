import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/integrations/core/registry";
import type { WebhookEnvelope } from "@/lib/integrations/core/provider";
import { verifySignature } from "@/lib/integrations/webhooks/signature";
import { computeIdempotencyKey } from "@/lib/integrations/webhooks/idempotency";
import { isRateLimited } from "@/lib/integrations/webhooks/rate-limit";
import { processWebhookEvent } from "@/lib/integrations/webhooks/processor";
import type { Json } from "@/lib/types/database";

const UNIQUE_VIOLATION = "23505";

// Default envelope reader, used when a provider doesn't implement its own
// resolveWebhookEvent() — assumes the source already sends {event_type,
// event_id} in our own naming convention.
function readEnvelope(payload: unknown): WebhookEnvelope {
  if (typeof payload !== "object" || payload === null) return { event_type: "unknown", event_id: null };
  const record = payload as Record<string, unknown>;
  return {
    event_type: typeof record.event_type === "string" ? record.event_type : "unknown",
    event_id: typeof record.event_id === "string" ? record.event_id : null,
  };
}

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider: providerSource } = await context.params;

  const rateLimitKey = `${providerSource}:${request.headers.get("x-forwarded-for") ?? "unknown"}`;
  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const provider = (() => {
    try {
      return getProvider(providerSource);
    } catch {
      return null;
    }
  })();
  if (!provider) {
    return NextResponse.json({ error: `Unknown provider "${providerSource}"` }, { status: 404 });
  }

  const rawBody = await request.text();

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  // Auth: a provider with its own scheme (e.g. EasyOrders' raw `secret`
  // header instead of a signed body) implements verifyWebhook() itself and
  // decides whether/how to enforce it. Otherwise fall back to the default —
  // HMAC-over-body, only enforced when a secret is configured (env var
  // <PROVIDER>_WEBHOOK_SECRET). The mock provider has neither, since it isn't
  // a real external system to spoof.
  if (provider.verifyWebhook) {
    if (!provider.verifyWebhook(rawBody, request.headers)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    const secret = process.env[`${providerSource.toUpperCase()}_WEBHOOK_SECRET`];
    if (secret) {
      const signatureHeader = request.headers.get("x-webhook-signature");
      if (!verifySignature(rawBody, signatureHeader, secret)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }
  }

  const envelope = provider.resolveWebhookEvent ? provider.resolveWebhookEvent(payload) : readEnvelope(payload);
  const eventType = envelope.event_type;
  const externalEventId = envelope.event_id;
  const idempotencyKey = computeIdempotencyKey(providerSource, eventType, externalEventId, rawBody);

  const supabase = createAdminClient();

  const { data: existing } = await supabase.from("webhook_events").select("id, status").eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existing) {
    return NextResponse.json({ status: "duplicate", eventId: existing.id }, { status: 200 });
  }

  const { data: eventRow, error: insertError } = await supabase
    .from("webhook_events")
    .insert({
      source: providerSource,
      event_type: eventType,
      external_event_id: externalEventId,
      payload: payload as Json,
      idempotency_key: idempotencyKey,
      status: "received",
    })
    .select("id")
    .single();

  if (insertError) {
    // Two deliveries racing past the SELECT-for-duplicates check above both
    // reach the insert; the unique index on idempotency_key is the real
    // guarantee — a 23505 here just means the other one won the race.
    if (insertError.code === UNIQUE_VIOLATION) {
      return NextResponse.json({ status: "duplicate" }, { status: 200 });
    }
    return NextResponse.json({ error: "Failed to store event" }, { status: 500 });
  }

  if (!eventRow) {
    return NextResponse.json({ error: "Failed to store event" }, { status: 500 });
  }

  // Processed inline for now — swap this call for a queue/background-job
  // enqueue later without touching anything above (the event is already
  // durably stored, so deferring processing is a pure implementation detail).
  // Always 200 once the event is durably stored, even if processing failed:
  // our own retry_count/next_retry_at mechanism owns retries from here, so a
  // non-2xx here would just make the source's retries race ours.
  const result = await processWebhookEvent(eventRow.id);
  return NextResponse.json({ status: result.status, eventId: eventRow.id }, { status: 200 });
}
