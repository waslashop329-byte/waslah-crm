import { readColumn, type ParsedRow } from "@/lib/import/spreadsheet-parser";
import { mapCustomerRow, IMPORT_SOURCE, type RowMapResult } from "@/lib/import/customer-row-mapper";
import type { NormalizedCustomer, NormalizedOrder, NormalizedOrderStatus } from "@/lib/integrations/types/normalized";

// Accepts the CRM's own internal status keys (case-insensitive) or the
// Arabic labels already shown throughout the UI, so a user copying statuses
// out of the CRM itself doesn't have to translate them back to English.
//
// Also accepts EasyOrders' own status vocabulary directly (confirmed
// against their real API docs and a real order export) — their statuses
// are far more granular than ours, so several map into the same internal
// bucket. Best-effort, same as main_system's original mapping: an
// unrecognized status would reject the whole row rather than default to
// something wrong, so every value from their docs is listed even where the
// mapping is a judgment call:
//   pending_payment -> pending (still unprocessed, awaiting payment)
//   paid -> confirmed (payment received, ready to move forward)
//   paid_failed -> pending (failed attempt, not necessarily a lost order —
//     needs a human to follow up, not an automatic cancellation)
//   waiting_for_pickup -> processing (being prepared, not shipped yet)
//   in_delivery -> shipped
//   returning_from_delivery / request_refund / refund_in_progress -> returned
//     (no distinct in-progress-refund concept exists internally yet)
const STATUS_ALIASES: Record<string, NormalizedOrderStatus> = {
  new: "new",
  "جديد": "new",
  pending: "pending",
  "معلق": "pending",
  "معلّق": "pending",
  pending_payment: "pending",
  paid_failed: "pending",
  confirmed: "confirmed",
  "مؤكد": "confirmed",
  paid: "confirmed",
  processing: "processing",
  "قيد التجهيز": "processing",
  waiting_for_pickup: "processing",
  shipped: "shipped",
  "تم الشحن": "shipped",
  in_delivery: "shipped",
  delivered: "delivered",
  "تم التسليم": "delivered",
  cancelled: "cancelled",
  canceled: "cancelled",
  "ملغى": "cancelled",
  "ملغي": "cancelled",
  returned: "returned",
  "مرتجع": "returned",
  returning_from_delivery: "returned",
  request_refund: "returned",
  refund_in_progress: "returned",
  refunded: "returned",
  failed_delivery: "failed_delivery",
  "failed delivery": "failed_delivery",
  "فشل التسليم": "failed_delivery",
};

function mapStatus(raw: string): NormalizedOrderStatus | null {
  return STATUS_ALIASES[raw.trim().toLowerCase()] ?? null;
}

// EasyOrders' export packs a multi-product order into ONE row: Product Name,
// Quantity, SKU, and Item Price all become newline-joined lists (one segment
// per product) instead of separate rows. Found live: 3 of 738 real rows had
// e.g. Quantity "1\n1" and Item Price "699\n349" for a 2-product order,
// which the single-line-item assumption below used to reject outright as an
// "Invalid quantity" error. A single-product row never contains "\n", so
// splitting always returns a 1-element array there and behaves exactly as
// before.
function splitMultiValue(raw: string | null): string[] {
  if (raw === null) return [];
  return raw.split("\n").map((v) => v.trim());
}

export interface OrderRowResult {
  customer: NormalizedCustomer;
  order: NormalizedOrder;
}

// Each order row carries its own customer name+phone (rather than requiring
// a separate Customers import to run first) — syncCustomer() is idempotent
// and matches by phone, so re-referencing the same customer across many
// order rows just finds/updates the same record every time, never
// duplicates it.
//
// Column set matches one specific real order-export format (a funnel/COD
// order tool's export — the one this business actually uploads), so this is
// deliberately the one canonical orders template rather than a generic
// least-common-denominator shape. Marketing/attribution columns present in
// that export (Utm Source, Utm Campaign, Funnel ID, Ref, Referral Code,
// Coupon, Coupon Discount, Payment Method, Payment Status, Extra Data,
// Extra Data 2) are read leniently — never required, never rejected if
// present — but not persisted anywhere yet; there's no attribution/coupon
// destination wired into the sync pipeline for orders today. Revisit if
// reporting on them becomes a real ask.
export function mapOrderRow(row: ParsedRow): RowMapResult<OrderRowResult> {
  const customerResult = mapCustomerRow(row);
  if (!customerResult.success) return customerResult;

  // "ID" is this export's own row identity — always present, short, and
  // what the business already recognizes an order by (unlike "External
  // Order ID", a UUID meant for cross-system linking, not for a human to
  // read) — so it's preferred both as the sync's matching key below AND as
  // what the Orders/Confirmation UI displays, with no separate displayCode
  // needed since this value is already human-friendly.
  const reference = readColumn(row, "ID", "Order ID", "External Order ID", "Order Reference", "رقم الطلب", "رقم الطلب الخارجي");
  const statusRaw = readColumn(row, "Status", "الحالة");
  const totalAmountRaw = readColumn(row, "Total Cost", "Total Amount", "Amount", "المبلغ الإجمالي", "المبلغ");
  const shippingCostRaw = readColumn(row, "Shipping Cost", "تكلفة الشحن");
  const orderDateRaw = readColumn(row, "CreatedAt", "Order Date", "Date", "تاريخ الطلب", "التاريخ");
  const note = readColumn(row, "Note", "ملاحظة", "ملاحظات");

  const productName = readColumn(row, "Product Name", "Product", "المنتج");
  const variant = readColumn(row, "Variant");
  const sku = readColumn(row, "SKU");
  const quantityRaw = readColumn(row, "Quantity", "الكمية");
  const itemPriceRaw = readColumn(row, "Item Price");

  if (!statusRaw) return { success: false, error: "Missing order status" };
  const status = mapStatus(statusRaw);
  if (!status) return { success: false, error: `Unrecognized status "${statusRaw}"` };

  if (!totalAmountRaw) return { success: false, error: "Missing total amount" };
  const totalAmount = Number(totalAmountRaw);
  if (!Number.isFinite(totalAmount) || totalAmount < 0) return { success: false, error: `Invalid total amount "${totalAmountRaw}"` };

  if (!orderDateRaw) return { success: false, error: "Missing order date" };
  const orderedAt = new Date(orderDateRaw);
  if (Number.isNaN(orderedAt.getTime())) return { success: false, error: `Invalid order date "${orderDateRaw}"` };

  let shippingCost: number | null = null;
  if (shippingCostRaw) {
    const parsed = Number(shippingCostRaw);
    if (!Number.isFinite(parsed) || parsed < 0) return { success: false, error: `Invalid shipping cost "${shippingCostRaw}"` };
    shippingCost = parsed;
  }

  // No explicit reference column: derive a stable external id from the
  // customer + date + amount so re-uploading the same file is idempotent
  // (same row twice never creates a second order) without forcing every
  // user to invent order numbers for historical data that never had one.
  const externalId = reference ?? `${customerResult.data.externalId}-${orderedAt.toISOString().slice(0, 10)}-${totalAmount}`;

  const productNames = splitMultiValue(productName).filter((name) => name !== "");
  const quantityValues = splitMultiValue(quantityRaw);
  const skuValues = splitMultiValue(sku);
  const itemPriceValues = splitMultiValue(itemPriceRaw);

  const productSummary = productNames.length > 0 ? (variant ? `${productNames.join(" + ")} (${variant})` : productNames.join(" + ")) : null;

  let lineItems: NormalizedOrder["lineItems"];
  if (productNames.length > 0) {
    lineItems = [];
    for (let i = 0; i < productNames.length; i++) {
      const name = productNames[i];
      const quantityForItem = quantityValues[i] || "1";
      const quantity = Number(quantityForItem);
      if (!Number.isFinite(quantity) || quantity <= 0) return { success: false, error: `Invalid quantity "${quantityForItem}"` };
      const itemPriceForItem = itemPriceValues[i];
      const unitPrice = itemPriceForItem ? Number(itemPriceForItem) : totalAmount;
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return { success: false, error: `Invalid item price "${itemPriceForItem}"` };
      lineItems.push({
        sku: skuValues[i] || null,
        name: variant && productNames.length === 1 ? `${name} (${variant})` : name,
        quantity,
        unitPrice,
      });
    }
  }

  const order: NormalizedOrder = {
    source: IMPORT_SOURCE,
    externalId,
    customerExternalId: customerResult.data.externalId,
    externalStatus: statusRaw,
    status,
    totalAmount,
    productSummary,
    lineItems,
    orderedAt: orderedAt.toISOString(),
    shippingCost,
    note: note || null,
  };

  return { success: true, data: { customer: customerResult.data, order } };
}
