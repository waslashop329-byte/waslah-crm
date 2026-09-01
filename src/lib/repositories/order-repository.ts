import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OrderRow, OrderStatus } from "@/lib/types/database";

export type OrderListSortColumn = "ordered_at" | "total_amount";

export interface OrderListParams {
  search?: string;
  status?: OrderStatus;
  orderedAfter?: string;
  orderedBefore?: string;
  assignedOnly?: boolean;
  sortBy?: OrderListSortColumn;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface OrderListRow extends OrderRow {
  customer_full_name: string;
}

export interface OrderListResult {
  orders: OrderListRow[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;

// Global orders list, backing the /orders page — every "Orders (30d)" /
// "Revenue (30d)" / "Ad Spend (30d)" style KPI on the dashboard links here
// with the matching filter instead of just showing a number with nowhere to go.
export async function listOrders(params: OrderListParams): Promise<OrderListResult> {
  const supabase = await createClient();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("orders").select("*, customers(full_name)", { count: "exact" });

  if (params.search) {
    const term = params.search.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, "");
      query = query.or(`external_order_id.ilike.%${escaped}%,external_order_code.ilike.%${escaped}%,product_summary.ilike.%${escaped}%`);
    }
  }

  if (params.status) query = query.eq("status", params.status);
  if (params.orderedAfter) query = query.gte("ordered_at", params.orderedAfter);
  if (params.orderedBefore) query = query.lte("ordered_at", params.orderedBefore);
  if (params.assignedOnly) query = query.not("assigned_to", "is", null);

  const sortBy = params.sortBy ?? "ordered_at";
  const ascending = params.sortDir === "asc";
  query = query.order(sortBy, { ascending }).range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  return {
    orders: (data ?? []).map((row) => {
      const { customers, ...order } = row as OrderRow & { customers: { full_name: string } | null };
      return { ...order, customer_full_name: customers?.full_name ?? "Unknown customer" };
    }),
    total: count ?? 0,
    page,
    pageSize,
  };
}
