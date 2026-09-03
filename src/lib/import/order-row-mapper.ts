import { readColumn, type ParsedRow } from "@/lib/import/spreadsheet-parser";
import { mapCustomerRow, IMPORT_SOURCE, type RowMapResult } from "@/lib/import/customer-row-mapper";
import type { NormalizedCustomer, NormalizedOrder, NormalizedOrderStatus } from "@/lib/integrations/types/normalized";

// Accepts the CRM's own internal status keys (case-insensitive) or the
// Arabic labels already shown throughout the UI, so a user copying statuses
// out of the CRM itself doesn't have to translate them back to English.
const STATUS_ALIASES: Record<string, NormalizedOrderStatus> = {
  new: "new",
  "جديد": "new",
  pending: "pending",
  "معلق": "pending",
  "معلّق": "pending",
  confirmed: "confirmed",
  "مؤكد": "confirmed",
  processing: "processing",
  "قيد التجهيز": "processing",
  shipped: "shipped",
  "تم الشحن": "shipped",
  delivered: "delivered",
  "تم التسليم": "delivered",
  cancelled: "cancelled",
  canceled: "cancelled",
  "ملغى": "cancelled",
  "ملغي": "cancelled",
  returned: "returned",
  "مرتجع": "returned",
  failed_delivery: "failed_delivery",
  "failed delivery": "failed_delivery",
  "فشل التسليم": "failed_delivery",
};

function mapStatus(raw: string): NormalizedOrderStatus | null {
  return STATUS_ALIASES[raw.trim().toLowerCase()] ?? null;
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

  const productSummary = productName ? (variant ? `${productName} (${variant})` : productName) : null;

  let lineItems: NormalizedOrder["lineItems"];
  if (productName) {
    const quantity = quantityRaw ? Number(quantityRaw) : 1;
    if (!Number.isFinite(quantity) || quantity <= 0) return { success: false, error: `Invalid quantity "${quantityRaw}"` };
    const unitPrice = itemPriceRaw ? Number(itemPriceRaw) : totalAmount;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return { success: false, error: `Invalid item price "${itemPriceRaw}"` };
    lineItems = [{ sku: sku || null, name: productSummary ?? productName, quantity, unitPrice }];
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
