// Real adapter for EasyOrders (app.easy-orders.net) — the funnel/COD order
// platform this business actually uses. Confirmed against their real public
// API docs (public-api-docs.easy-orders.net) and a real order export.
//
// Unlike main_system, there is no bulk/list-orders endpoint at all in their
// public API (only get-by-id) — historical data comes from their dashboard's
// Excel export instead (src/lib/import/order-row-mapper.ts handles that).
// This adapter is webhook-only: ongoing orders arrive via their real-time
// Webhooks feature (seller dashboard → Public API → Webhooks), not polling.
//
// Their webhook shapes don't follow the {event_type, event_id} envelope the
// rest of this integration layer assumes, and their auth is a raw shared
// secret in a `secret` header rather than a signed body — see
// verifyWebhook()/resolveWebhookEvent() below for how this adapter bridges
// that to the generic webhook route.
import "server-only";
import type { IntegrationProvider, ProviderCapability, TestConnectionResult, WebhookEnvelope } from "@/lib/integrations/core/provider";
import type { NormalizedCustomer, NormalizedOrder, NormalizedOrderStatus } from "@/lib/integrations/types/normalized";
import { normalizePhone } from "@/lib/integrations/normalizers/phone";
import { verifySharedSecret } from "@/lib/integrations/webhooks/signature";
import { updateOrderStatus } from "@/lib/integrations/sync/order-sync";
import { NonRetryableIntegrationError } from "@/lib/integrations/core/errors";

export const EASY_ORDERS_SOURCE = "easy_orders";

// Their full status vocabulary, confirmed against the "Update Order Status"
// API docs — same mapping decisions as order-row-mapper.ts's STATUS_ALIASES
// (kept as its own copy here rather than shared: that map also carries
// CRM-internal/Arabic aliases the Excel importer needs but a webhook payload
// never sends, e.g. only ever these exact lowercase English keys).
const STATUS_MAP: Record<string, NormalizedOrderStatus> = {
  pending: "pending",
  pending_payment: "pending",
  paid_failed: "pending",
  confirmed: "confirmed",
  paid: "confirmed",
  processing: "processing",
  waiting_for_pickup: "processing",
  in_delivery: "shipped",
  delivered: "delivered",
  canceled: "cancelled",
  cancelled: "cancelled",
  returning_from_delivery: "returned",
  request_refund: "returned",
  refund_in_progress: "returned",
  refunded: "returned",
};

function mapStatus(raw: string): NormalizedOrderStatus {
  return STATUS_MAP[raw.trim().toLowerCase()] ?? "pending";
}

interface RawCartItemProduct {
  name: string;
  sku: string | null;
}

interface RawCartItem {
  price: number;
  quantity: number;
  product?: RawCartItemProduct;
}

interface RawOrderCreated {
  id: string;
  created_at: string;
  updated_at: string;
  total_cost: number;
  shipping_cost: number;
  status: string;
  full_name: string;
  phone: string;
  government: string | null;
  address: string | null;
  cart_items: RawCartItem[];
}

interface RawStatusChange {
  event_type: "order-status-update";
  order_id: string;
  old_status: string;
  new_status: string;
}

function isOrderCreatedPayload(raw: unknown): raw is RawOrderCreated {
  return typeof raw === "object" && raw !== null && "id" in raw && "cart_items" in raw && !("event_type" in raw);
}

function isStatusChangePayload(raw: unknown): raw is RawStatusChange {
  return typeof raw === "object" && raw !== null && (raw as Record<string, unknown>).event_type === "order-status-update";
}

function deriveCustomer(raw: RawOrderCreated): NormalizedCustomer {
  return {
    source: EASY_ORDERS_SOURCE,
    // EasyOrders' order webhook has no persistent customer id — same "a
    // customer IS a phone number" shape as main_system, and matchCustomer()
    // already keys on phone, so this stays idempotent across repeat orders.
    externalId: raw.phone,
    fullName: raw.full_name,
    email: null,
    phones: [normalizePhone(raw.phone)],
    addresses: raw.address ? [{ addressLine: raw.address, governorate: raw.government, isPrimary: true }] : undefined,
  };
}

async function normalizeOrder(raw: unknown): Promise<NormalizedOrder> {
  if (!isOrderCreatedPayload(raw)) throw new NonRetryableIntegrationError("Payload does not look like an EasyOrders order-created event");

  const status = mapStatus(raw.status);

  return {
    source: EASY_ORDERS_SOURCE,
    externalId: raw.id,
    customerExternalId: raw.phone,
    externalStatus: raw.status,
    status,
    totalAmount: raw.total_cost,
    productSummary: raw.cart_items.map((item) => item.product?.name).filter(Boolean).join(", ") || null,
    lineItems: raw.cart_items.map((item) => ({
      sku: item.product?.sku ?? null,
      name: item.product?.name ?? "Unknown product",
      quantity: item.quantity,
      unitPrice: item.price,
    })),
    orderedAt: raw.created_at,
    shippingCost: raw.shipping_cost,
    // Orders always arrive "pending" in practice (confirmed against a real
    // 738-order export) — later transitions come through the separate
    // "Order Status Change" webhook, handled by applyOrderStatusChange().
    confirmedAt: status === "confirmed" ? raw.updated_at : null,
    shippedAt: status === "shipped" ? raw.updated_at : null,
    deliveredAt: status === "delivered" ? raw.updated_at : null,
    cancelledAt: status === "cancelled" ? raw.updated_at : null,
    returnedAt: status === "returned" ? raw.updated_at : null,
  };
}

async function deriveCustomerFromOrder(raw: unknown): Promise<NormalizedCustomer> {
  if (!isOrderCreatedPayload(raw)) throw new NonRetryableIntegrationError("Payload does not look like an EasyOrders order-created event");
  return deriveCustomer(raw);
}

async function applyOrderStatusChange(raw: unknown): Promise<void> {
  if (!isStatusChangePayload(raw)) throw new NonRetryableIntegrationError("Payload does not look like an EasyOrders status-change event");
  await updateOrderStatus(EASY_ORDERS_SOURCE, raw.order_id, mapStatus(raw.new_status));
}

function verifyWebhook(_rawBody: string, headers: Headers): boolean {
  const secret = process.env.EASY_ORDERS_WEBHOOK_SECRET;
  if (!secret) return true; // not configured yet — same "opt-in" behavior as the default HMAC scheme before a secret exists
  return verifySharedSecret(headers.get("secret"), secret);
}

function resolveWebhookEvent(payload: unknown): WebhookEnvelope {
  if (isStatusChangePayload(payload)) {
    // No stable event id in this payload — falls back to hashing the body,
    // which already varies per real transition (order_id + old/new status).
    return { event_type: "order.status_changed", event_id: null };
  }
  if (isOrderCreatedPayload(payload)) {
    return { event_type: "order.created", event_id: payload.id };
  }
  return { event_type: "unknown", event_id: null };
}

export function createEasyOrdersProvider(): IntegrationProvider {
  const capabilities: ProviderCapability[] = ["testConnection"];

  return {
    source: EASY_ORDERS_SOURCE,
    capabilities,

    async testConnection(): Promise<TestConnectionResult> {
      // Webhook-only integration — there's no polling connection to test,
      // just whether the secret this adapter checks incoming requests
      // against has been configured yet.
      if (!process.env.EASY_ORDERS_WEBHOOK_SECRET) {
        return { ok: false, message: "EASY_ORDERS_WEBHOOK_SECRET is not configured." };
      }
      return { ok: true, message: "Webhook secret configured — waiting for EasyOrders to send events." };
    },

    normalizeOrder,
    deriveCustomerFromOrder,
    applyOrderStatusChange,
    verifyWebhook,
    resolveWebhookEvent,
  };
}
