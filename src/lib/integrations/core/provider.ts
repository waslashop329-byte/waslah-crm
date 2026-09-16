import type { NormalizedCustomer, NormalizedEmployee, NormalizedOrder } from "@/lib/integrations/types/normalized";

// Every capability a provider *could* implement. Adapters declare which of
// these they actually support in `capabilities` — nothing forces a provider
// to implement a method it can't (e.g. a webhook-only source has no
// fetchCustomers). Callers must check `capabilities` before calling an
// optional method.
export type ProviderCapability = "testConnection" | "fetchCustomers" | "fetchOrders" | "fetchUpdatedOrders" | "fetchEmployees";

export interface FetchPageParams {
  /** ISO timestamp cursor — fetch records changed/created since this point. */
  since?: string;
  cursor?: string | null;
  limit?: number;
}

export interface FetchPageResult<T> {
  records: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface TestConnectionResult {
  ok: boolean;
  message?: string;
}

// What the webhook route needs to know about an inbound event before it can
// store/dispatch it: the canonical event_type it should be filed under
// (customer.*/order.*/order.status_changed) and, when the source provides
// one, a stable id for idempotency.
export interface WebhookEnvelope {
  event_type: string;
  event_id: string | null;
}

export interface IntegrationProvider {
  readonly source: string;
  readonly capabilities: readonly ProviderCapability[];

  testConnection(): Promise<TestConnectionResult>;

  fetchCustomers?(params: FetchPageParams): Promise<FetchPageResult<NormalizedCustomer>>;
  fetchOrders?(params: FetchPageParams): Promise<FetchPageResult<NormalizedOrder>>;
  fetchUpdatedOrders?(params: FetchPageParams): Promise<FetchPageResult<NormalizedOrder>>;
  fetchEmployees?(params: FetchPageParams): Promise<FetchPageResult<NormalizedEmployee>>;

  // Normalize a single raw payload (e.g. one webhook body) without a full
  // fetch/pagination call. fetch* methods above use these internally too, so
  // there's exactly one place per provider that knows the raw shape.
  normalizeCustomer?(raw: unknown): Promise<NormalizedCustomer>;
  normalizeOrder?(raw: unknown): Promise<NormalizedOrder>;

  // A source whose "order created" webhook embeds full customer data inline
  // (no separate customer.* event ever arrives, e.g. EasyOrders) implements
  // this so the processor can sync that customer first — normalizeOrder
  // alone can't, since syncOrder() requires the customer to already exist.
  deriveCustomerFromOrder?(raw: unknown): Promise<NormalizedCustomer>;

  // A source whose status-change webhook carries only an id + old/new status
  // (no full order fields) implements this instead of relying on
  // normalizeOrder + syncOrder, which would need every required order field.
  applyOrderStatusChange?(raw: unknown): Promise<void>;

  // Only needed when a source's auth scheme isn't the default HMAC-over-body
  // (route.ts falls back to that when this is absent) — e.g. EasyOrders
  // sends the raw shared secret itself in a `secret` header.
  verifyWebhook?(rawBody: string, headers: Headers): boolean;

  // Only needed when a source's webhook payload doesn't carry {event_type,
  // event_id} in that shape (route.ts falls back to reading those fields
  // directly when this is absent) — e.g. EasyOrders' "Order Created" payload
  // has no event_type at all, and "Order Status Change" uses "order-status-
  // update" rather than our "order.*"/"customer.*" convention.
  resolveWebhookEvent?(payload: unknown): WebhookEnvelope;
}

export function providerSupports(provider: IntegrationProvider, capability: ProviderCapability): boolean {
  return provider.capabilities.includes(capability);
}
