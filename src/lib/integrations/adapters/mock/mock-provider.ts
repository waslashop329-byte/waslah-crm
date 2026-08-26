// Development/architecture-testing provider only. It demonstrates the full
// IntegrationProvider contract — different field names, a different status
// vocabulary, pagination — so the sync engine can be built and tested before
// the real operations-system API exists. Nothing here is CRM business logic;
// swapping this for `adapters/main-system` later should require zero changes
// outside this file plus a new adapter of the same shape.
import type { FetchPageParams, FetchPageResult, IntegrationProvider, ProviderCapability, TestConnectionResult } from "@/lib/integrations/core/provider";
import type { NormalizedCustomer, NormalizedOrder } from "@/lib/integrations/types/normalized";
import { normalizePhone } from "@/lib/integrations/normalizers/phone";
import { mapExternalStatus } from "@/lib/integrations/mappers/order-status-mapper";

export const MOCK_SOURCE = "mock";

// The mock system's own (deliberately different) shapes — mirrors Part 2's
// "External System A/B" example so the normalizer has real work to do.
export interface MockRawCustomer {
  customer_id: string;
  customer_name: string;
  mobile: string;
  email_address: string | null;
}

export interface MockRawOrder {
  order_id: string;
  customer_id: string;
  order_status: string; // NEW | AWAITING_CONFIRMATION | CONFIRMED | PACKED | OUT_FOR_DELIVERY | DELIVERED | CUSTOMER_CANCELLED | RETURNED_TO_WAREHOUSE | DELIVERY_FAILED
  amount: number;
  items_description: string;
  placed_at: string;
  updated_at: string;
}

const MOCK_CUSTOMERS: MockRawCustomer[] = [
  { customer_id: "MOCK-CUST-0001", customer_name: "Mona Abdel Fattah", mobile: "01012345001", email_address: "mona.af@example.com" },
  { customer_id: "MOCK-CUST-0011", customer_name: "Sherif Adly", mobile: "01123456099", email_address: null },
];

const MOCK_ORDERS: MockRawOrder[] = [
  {
    order_id: "MOCK-ORD-9001",
    customer_id: "MOCK-CUST-0011",
    order_status: "AWAITING_CONFIRMATION",
    amount: 1250,
    items_description: "Wireless Earbuds",
    placed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    order_id: "MOCK-ORD-9002",
    customer_id: "MOCK-CUST-0001",
    order_status: "DELIVERED",
    amount: 899,
    items_description: "Perfume Bundle",
    placed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

function isMockRawCustomer(raw: unknown): raw is MockRawCustomer {
  return typeof raw === "object" && raw !== null && "customer_id" in raw && "customer_name" in raw;
}

function isMockRawOrder(raw: unknown): raw is MockRawOrder {
  return typeof raw === "object" && raw !== null && "order_id" in raw && "order_status" in raw;
}

async function normalizeMockCustomer(raw: unknown): Promise<NormalizedCustomer> {
  if (!isMockRawCustomer(raw)) throw new Error("Payload does not look like a mock customer");

  return {
    source: MOCK_SOURCE,
    externalId: raw.customer_id,
    fullName: raw.customer_name,
    email: raw.email_address,
    phones: [normalizePhone(raw.mobile, "EG")],
  };
}

async function normalizeMockOrder(raw: unknown): Promise<NormalizedOrder> {
  if (!isMockRawOrder(raw)) throw new Error("Payload does not look like a mock order");

  const status = await mapExternalStatus(MOCK_SOURCE, raw.order_status);

  return {
    source: MOCK_SOURCE,
    externalId: raw.order_id,
    customerExternalId: raw.customer_id,
    externalStatus: raw.order_status,
    status,
    totalAmount: raw.amount,
    productSummary: raw.items_description,
    orderedAt: raw.placed_at,
    deliveredAt: status === "delivered" ? raw.updated_at : null,
    cancelledAt: status === "cancelled" ? raw.updated_at : null,
    returnedAt: status === "returned" ? raw.updated_at : null,
  };
}

export function createMockProvider(): IntegrationProvider {
  const capabilities: ProviderCapability[] = ["testConnection", "fetchCustomers", "fetchOrders", "fetchUpdatedOrders"];

  return {
    source: MOCK_SOURCE,
    capabilities,

    async testConnection(): Promise<TestConnectionResult> {
      return { ok: true, message: "Mock provider is always reachable." };
    },

    normalizeCustomer: normalizeMockCustomer,
    normalizeOrder: normalizeMockOrder,

    async fetchCustomers(params: FetchPageParams): Promise<FetchPageResult<NormalizedCustomer>> {
      const limit = params.limit ?? 50;
      const records = await Promise.all(MOCK_CUSTOMERS.slice(0, limit).map(normalizeMockCustomer));
      return { records, nextCursor: null, hasMore: false };
    },

    async fetchOrders(params: FetchPageParams): Promise<FetchPageResult<NormalizedOrder>> {
      const limit = params.limit ?? 50;
      const records = await Promise.all(MOCK_ORDERS.slice(0, limit).map(normalizeMockOrder));
      return { records, nextCursor: null, hasMore: false };
    },

    async fetchUpdatedOrders(params: FetchPageParams): Promise<FetchPageResult<NormalizedOrder>> {
      const since = params.since ? new Date(params.since) : null;
      const changed = MOCK_ORDERS.filter((order) => !since || new Date(order.updated_at) > since);
      const records = await Promise.all(changed.map(normalizeMockOrder));
      return { records, nextCursor: null, hasMore: false };
    },
  };
}
