// Minimal in-memory sliding-window limiter. Good enough for a single
// instance; on a multi-instance deployment each instance has its own
// counters, so this only bounds abuse per-instance, not globally — swap for
// a shared store (Redis/Upstash) if that ever matters in production.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;

const requestLog = new Map<string, number[]>();

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    requestLog.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  requestLog.set(key, timestamps);
  return false;
}
