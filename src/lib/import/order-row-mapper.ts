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
export function mapOrderRow(row: ParsedRow): RowMapResult<OrderRowResult> {
  const customerResult = mapCustomerRow(row);
  if (!customerResult.success) return customerResult;

  const reference = readColumn(row, "Order Reference", "Order ID", "رقم الطلب", "رقم الطلب الخارجي");
  const productSummary = readColumn(row, "Product", "المنتج");
  const statusRaw = readColumn(row, "Status", "الحالة");
  const totalAmountRaw = readColumn(row, "Total Amount", "Amount", "المبلغ الإجمالي", "المبلغ");
  const orderDateRaw = readColumn(row, "Order Date", "Date", "تاريخ الطلب", "التاريخ");

  if (!statusRaw) return { success: false, error: "Missing order status" };
  const status = mapStatus(statusRaw);
  if (!status) return { success: false, error: `Unrecognized status "${statusRaw}"` };

  if (!totalAmountRaw) return { success: false, error: "Missing total amount" };
  const totalAmount = Number(totalAmountRaw);
  if (!Number.isFinite(totalAmount) || totalAmount < 0) return { success: false, error: `Invalid total amount "${totalAmountRaw}"` };

  if (!orderDateRaw) return { success: false, error: "Missing order date" };
  const orderedAt = new Date(orderDateRaw);
  if (Number.isNaN(orderedAt.getTime())) return { success: false, error: `Invalid order date "${orderDateRaw}"` };

  // No explicit reference column: derive a stable external id from the
  // customer + date + amount so re-uploading the same file is idempotent
  // (same row twice never creates a second order) without forcing every
  // user to invent order numbers for historical data that never had one.
  const externalId = reference ?? `${customerResult.data.externalId}-${orderedAt.toISOString().slice(0, 10)}-${totalAmount}`;

  const order: NormalizedOrder = {
    source: IMPORT_SOURCE,
    externalId,
    customerExternalId: customerResult.data.externalId,
    externalStatus: statusRaw,
    status,
    totalAmount,
    productSummary: productSummary || null,
    orderedAt: orderedAt.toISOString(),
  };

  return { success: true, data: { customer: customerResult.data, order } };
}
