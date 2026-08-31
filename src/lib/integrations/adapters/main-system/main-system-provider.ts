// Real adapter for the teammate's ops system ("Waslah Ops System"), wired up
// once API docs + a live key existed — see main-system-provider docs thread.
// Base URL: MAIN_SYSTEM_BASE_URL env var. Auth: Bearer MAIN_SYSTEM_API_KEY.
//
// Their data model: "there's no customer table — a customer IS a phone
// number that has placed orders." A customer who changes phone becomes two
// separate records on their side; name/address always come from that
// phone's most recent order. This lines up exactly with how this CRM's own
// matchCustomer()/customer_external_ids already key on phone — externalId
// is the raw phone string, unmodified, so repeated syncs stay idempotent.
//
// Status: they explicitly warn to key logic off status.key, never
// status.name (renameable from their merchant dashboard). The full
// status.key vocabulary wasn't given (only "new"/"confirmed"/"cancelled…"
// as examples), so externalStatus carries status.key through to the
// DB-configurable external_status_mappings table (seeded with a best-effort
// starting set in migration 0065) rather than a hardcoded switch — an
// unmapped key safely falls back to "pending", never crashes or miscounts.
import "server-only";
import type { FetchPageParams, FetchPageResult, IntegrationProvider, ProviderCapability, TestConnectionResult } from "@/lib/integrations/core/provider";
import type { NormalizedCustomer, NormalizedOrder } from "@/lib/integrations/types/normalized";
import { normalizePhone } from "@/lib/integrations/normalizers/phone";
import { mapExternalStatus } from "@/lib/integrations/mappers/order-status-mapper";
import { RetryableIntegrationError, NonRetryableIntegrationError } from "@/lib/integrations/core/errors";

export const MAIN_SYSTEM_SOURCE = "main_system";

interface RawAddress {
  governorate: string | null;
  area: string | null;
  line: string | null;
}

interface RawCustomer {
  phone: string;
  name: string;
  alt_phone: string | null;
  address: RawAddress | null;
  orders_count: number;
  orders_total: number;
  first_order_at: string | null;
  last_order_at: string | null;
  updated_at: string;
}

interface RawOrderItem {
  sku: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  from_upsell: boolean;
}

interface RawOrder {
  id: string;
  code: string;
  customer: { name: string; phone: string; alt_phone: string | null };
  address: RawAddress | null;
  status: { key: string; name: string; stage: string };
  items: RawOrderItem[];
  totals: { shipping: number; discount: number; total: number };
  shipment: unknown;
  created_at: string;
  updated_at: string;
  delivered_at: string | null;
}

interface RawPage<T> {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
}

interface RawErrorBody {
  error?: string;
  code?: string;
}

function getConfig(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = process.env.MAIN_SYSTEM_BASE_URL;
  const apiKey = process.env.MAIN_SYSTEM_API_KEY;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

async function apiGet<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const config = getConfig();
  if (!config) {
    throw new NonRetryableIntegrationError("MAIN_SYSTEM_BASE_URL / MAIN_SYSTEM_API_KEY is not configured");
  }

  const url = new URL(`${config.baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${config.apiKey}` } });
  } catch (error) {
    throw new RetryableIntegrationError(`Network error calling ${path}: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  if (!response.ok) {
    let body: RawErrorBody = {};
    try {
      body = (await response.json()) as RawErrorBody;
    } catch {
      // Non-JSON error body — fall through with the bare status.
    }
    const message = `${path} returned ${response.status}${body.code ? ` (${body.code})` : ""}: ${body.error ?? response.statusText}`;

    // 401/403 (bad or unauthorized credentials) and 400 (malformed request,
    // e.g. a non-ISO updated_since) won't succeed on retry with the same
    // input. Everything else (429, 5xx) is worth retrying.
    if (response.status === 401 || response.status === 403 || response.status === 400) {
      throw new NonRetryableIntegrationError(message);
    }
    throw new RetryableIntegrationError(message);
  }

  return (await response.json()) as T;
}

function normalizeCustomer(raw: RawCustomer): NormalizedCustomer {
  const phones = [normalizePhone(raw.phone)];
  if (raw.alt_phone) phones.push(normalizePhone(raw.alt_phone));

  const customer: NormalizedCustomer = {
    source: MAIN_SYSTEM_SOURCE,
    externalId: raw.phone,
    fullName: raw.name,
    email: null,
    phones,
  };

  if (raw.address?.line) {
    customer.addresses = [
      { addressLine: raw.address.line, governorate: raw.address.governorate, area: raw.address.area, isPrimary: true },
    ];
  }

  return customer;
}

async function normalizeOrder(raw: RawOrder): Promise<NormalizedOrder> {
  const status = await mapExternalStatus(MAIN_SYSTEM_SOURCE, raw.status.key);

  return {
    source: MAIN_SYSTEM_SOURCE,
    externalId: raw.id,
    customerExternalId: raw.customer.phone,
    externalStatus: raw.status.key,
    status,
    totalAmount: raw.totals.total,
    productSummary: raw.items.map((item) => item.name).join(", ") || null,
    lineItems: raw.items.map((item) => ({ sku: item.sku, name: item.name, quantity: item.quantity, unitPrice: item.unit_price })),
    orderedAt: raw.created_at,
    deliveredAt: raw.delivered_at,
    cancelledAt: status === "cancelled" ? raw.updated_at : null,
    returnedAt: status === "returned" ? raw.updated_at : null,
  };
}

export function createMainSystemProvider(): IntegrationProvider {
  const capabilities: ProviderCapability[] = ["testConnection", "fetchCustomers", "fetchOrders", "fetchUpdatedOrders"];

  async function fetchCustomersPage(params: FetchPageParams): Promise<FetchPageResult<NormalizedCustomer>> {
    const page = await apiGet<RawPage<RawCustomer>>("/customers", {
      limit: params.limit ?? 50,
      cursor: params.cursor ?? undefined,
      updated_since: params.since,
    });
    return { records: page.data.map(normalizeCustomer), nextCursor: page.next_cursor, hasMore: page.has_more };
  }

  async function fetchOrdersPage(params: FetchPageParams): Promise<FetchPageResult<NormalizedOrder>> {
    const page = await apiGet<RawPage<RawOrder>>("/orders", {
      limit: params.limit ?? 50,
      cursor: params.cursor ?? undefined,
      updated_since: params.since,
    });
    const records = await Promise.all(page.data.map(normalizeOrder));
    return { records, nextCursor: page.next_cursor, hasMore: page.has_more };
  }

  return {
    source: MAIN_SYSTEM_SOURCE,
    capabilities,

    async testConnection(): Promise<TestConnectionResult> {
      if (!getConfig()) {
        return { ok: false, message: "MAIN_SYSTEM_BASE_URL / MAIN_SYSTEM_API_KEY is not configured." };
      }
      try {
        await apiGet<RawPage<RawCustomer>>("/customers", { limit: 1 });
        return { ok: true, message: "Connected to the Waslah Ops System API." };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : "Connection failed" };
      }
    },

    fetchCustomers: fetchCustomersPage,
    fetchOrders: fetchOrdersPage,
    // "scheduled" syncs call this with `since` = the last successful sync
    // time (sync-runner.ts) — same endpoint, just with updated_since set,
    // per their documented incremental-sync recipe.
    fetchUpdatedOrders: fetchOrdersPage,
  };
}
