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
}

export function providerSupports(provider: IntegrationProvider, capability: ProviderCapability): boolean {
  return provider.capabilities.includes(capability);
}
