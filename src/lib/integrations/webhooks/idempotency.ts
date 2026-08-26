import { createHash } from "node:crypto";

// Part 8: prefer provider + external_event_id when the source sends one;
// fall back to provider + event_type + payload hash when it doesn't (still
// deterministic — the exact same body redelivered produces the same key).
export function computeIdempotencyKey(source: string, eventType: string, externalEventId: string | null, rawBody: string): string {
  if (externalEventId) {
    return `${source}:${externalEventId}`;
  }
  const hash = createHash("sha256").update(rawBody).digest("hex").slice(0, 32);
  return `${source}:${eventType}:${hash}`;
}
