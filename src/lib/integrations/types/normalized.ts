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
}

export interface NormalizedOrder {
  source: string;
  externalId: string;
  customerExternalId: string;
  /** Original status string exactly as the source sent it, before mapping. */
  externalStatus: string;
  status: NormalizedOrderStatus;
  totalAmount: number;
  productSummary?: string | null;
  orderedAt: string;
  confirmedAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  returnedAt?: string | null;
}

export interface NormalizedEmployee {
  source: string;
  externalId: string;
  fullName: string;
  email?: string | null;
}
