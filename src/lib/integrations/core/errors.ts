// Structured error classification (Part 12): every place in the integration
// layer that can fail should throw one of these instead of a bare Error, so
// the retry logic never has to guess whether re-attempting makes sense.
export class IntegrationError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "IntegrationError";
    this.retryable = retryable;
  }
}

// Temporary network failure, rate limiting, 5xx from the source, or "the
// customer this order references hasn't synced yet" — a later attempt could
// succeed without any input changing.
export class RetryableIntegrationError extends IntegrationError {
  constructor(message: string) {
    super(message, true);
    this.name = "RetryableIntegrationError";
  }
}

// Invalid credentials, malformed payload, schema validation failure — the
// input itself is wrong, so retrying with the same input will fail the same
// way every time. Needs a human or a corrected payload, not a retry.
export class NonRetryableIntegrationError extends IntegrationError {
  constructor(message: string) {
    super(message, false);
    this.name = "NonRetryableIntegrationError";
  }
}

// Fallback classification for errors that didn't originate as an
// IntegrationError (e.g. an unexpected Supabase/network exception).
export function isRetryable(error: unknown): boolean {
  if (error instanceof IntegrationError) return error.retryable;

  if (error instanceof Error) {
    const nonRetryableHints = ["validation", "invalid", "does not look like", "no integration provider registered"];
    return !nonRetryableHints.some((hint) => error.message.toLowerCase().includes(hint));
  }

  return true;
}
