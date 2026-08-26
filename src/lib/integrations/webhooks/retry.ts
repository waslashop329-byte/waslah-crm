// Configurable retry limit + exponential backoff (Part 13). Not tied to any
// scheduler — something else (Step 8's scheduled-sync entrypoint, or a cron
// hitting a "process due retries" endpoint) is responsible for actually
// calling processWebhookEvent again once next_retry_at has passed.
export const MAX_WEBHOOK_RETRY_COUNT = 5;
const BASE_DELAY_MS = 60_000; // 1 minute, doubling each attempt

export function computeNextRetryAt(retryCount: number): string | null {
  if (retryCount >= MAX_WEBHOOK_RETRY_COUNT) return null; // exhausted — needs a manual retry
  const delayMs = BASE_DELAY_MS * 2 ** retryCount;
  return new Date(Date.now() + delayMs).toISOString();
}
