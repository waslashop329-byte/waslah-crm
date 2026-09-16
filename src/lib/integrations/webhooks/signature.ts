import { createHmac, timingSafeEqual } from "node:crypto";

// Standard HMAC-SHA256 verification (the scheme most webhook providers use,
// e.g. `X-Signature: sha256=<hex>`). The real operations system's exact
// signing scheme isn't documented yet — when it is, if it differs, only this
// file needs to change; the route handler just calls verifySignature().
export function computeSignature(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) return false;

  const provided = signatureHeader.replace(/^sha256=/, "").trim();
  const expected = computeSignature(rawBody, secret);

  const providedBuffer = Buffer.from(provided, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

// For sources that send the raw shared secret itself in a header (e.g.
// EasyOrders' `secret: <value>`) instead of signing the body — no HMAC
// computed, just a constant-time comparison against the configured secret.
export function verifySharedSecret(provided: string | null, expected: string): boolean {
  if (!provided) return false;

  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
