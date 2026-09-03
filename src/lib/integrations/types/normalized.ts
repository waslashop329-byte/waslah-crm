// Normalized domain models: the shape every part of the CRM outside this
// integrations module is allowed to depend on. External API response shapes
// (Part 2) must never leak past the adapter that fetched them — everything
// downstream (matching, sync, timeline) works only with these types.
import type { OrderStatus } from "@/lib/types/database";

export type NormalizedOrderStatus = OrderStatus;

export interface NormalizedPhone {
  /** Exactly as received from the source. Never overwritten. */
  raw: string;
  /** E.164-ish normalized form, or null if it couldn't be parsed. */
  normalized: string | null;
  country: string;
}

export interface NormalizedAddress {
  addressLine: string;
  city?: string | null;
  governorate?: string | null;
  area?: string | null;
  details?: string | null;
  isPrimary?: boolean;
}

export interface NormalizedCustomer {
  source: string;
  externalId: string;
  fullName: string;
  email?: string | null;
  phones: NormalizedPhone[];
  addresses?: NormalizedAddress[];
  /** When this customer actually became one (e.g. their real first-order date), if the source knows it. Only applied on first insert — never overwrites an existing customer_since on a later match. */
  customerSince?: string | null;
}

export interface NormalizedLineItem {
  sku: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface NormalizedOrder {
  source: string;
  externalId: string;
  /** Human-readable order number the source's own staff recognize (e.g. an order code shown in their ops dashboard) — distinct from externalId, which is often an opaque internal id not meant for display. Falls back to externalId in the UI when a source doesn't provide one. */
  displayCode?: string | null;
  customerExternalId: string;
  /** Original status string exactly as the source sent it, before mapping. */
  externalStatus: string;
  status: NormalizedOrderStatus;
  totalAmount: number;
  productSummary?: string | null;
  /** Real structured line items, when the source provides them — order-sync.ts persists these as multiple order_items rows instead of the single best-effort match productSummary alone gives. */
  lineItems?: NormalizedLineItem[];
  orderedAt: string;
  confirmedAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  returnedAt?: string | null;
  /** Only ever applied on first insert (order-sync.ts), same "insert-only" treatment as customerSince — a real cost figure from the source shouldn't silently overwrite one an admin later corrected by hand on the Orders tab. */
  shippingCost?: number | null;
  /** A free-text note attached to the order at import time (e.g. a delivery instruction) — order-sync.ts creates it as a real customer note rather than folding it into productSummary, so it shows up where notes are already surfaced instead of corrupting the product-name field. */
  note?: string | null;
}

export interface NormalizedEmployee {
  source: string;
  externalId: string;
  fullName: string;
  email?: string | null;
}
