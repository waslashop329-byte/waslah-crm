import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CustomerListViewRow, CustomerStatus, ScoreCategory } from "@/lib/types/database";

export type CustomerSortColumn = "last_order_at" | "total_spend" | "total_orders" | "score" | "customer_since";

export interface CustomerListParams {
  search?: string;
  tagIds?: string[];
  tagNames?: string[];
  minOrders?: number;
  minDelivered?: number;
  minCancelled?: number;
  scoreMin?: number;
  scoreMax?: number;
  scoreCategory?: ScoreCategory;
  lastOrderAfter?: string;
  createdAfter?: string;
  /** True when cancelled_orders > delivered_orders — the dashboard's "High Cancellation Risk" segment. */
  cancelledGtDelivered?: boolean;
  /** last_order_at older than this ISO date, or never ordered — the dashboard's "Inactive" segment. */
  inactiveSince?: string;
  status?: CustomerStatus;
  sortBy?: CustomerSortColumn;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface CustomerListResult {
  customers: CustomerListViewRow[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;

export async function listCustomers(params: CustomerListParams): Promise<CustomerListResult> {
  const supabase = await createClient();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("customer_list_view").select("*", { count: "exact" }).is("deleted_at", null);

  if (params.search) {
    const term = params.search.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, "");
      query = query.or(`full_name.ilike.%${escaped}%,primary_phone.ilike.%${escaped}%,order_ids.ilike.%${escaped}%`);
    }
  }

  if (params.tagIds && params.tagIds.length > 0) {
    query = query.overlaps("tag_ids", params.tagIds);
  }
  if (params.tagNames && params.tagNames.length > 0) {
    query = query.overlaps("tag_names", params.tagNames);
  }

  if (params.minOrders !== undefined) query = query.gte("total_orders", params.minOrders);
  if (params.minDelivered !== undefined) query = query.gte("delivered_orders", params.minDelivered);
  if (params.minCancelled !== undefined) query = query.gte("cancelled_orders", params.minCancelled);
  if (params.scoreMin !== undefined) query = query.gte("score", params.scoreMin);
  if (params.scoreMax !== undefined) query = query.lte("score", params.scoreMax);
  if (params.scoreCategory) query = query.eq("score_category", params.scoreCategory);
  if (params.lastOrderAfter) query = query.gte("last_order_at", params.lastOrderAfter);
  if (params.createdAfter) query = query.gte("customer_since", params.createdAfter);
  if (params.cancelledGtDelivered) query = query.eq("cancelled_gt_delivered", true);
  if (params.inactiveSince) query = query.or(`last_order_at.lt.${params.inactiveSince},last_order_at.is.null`);
  if (params.status) query = query.eq("status", params.status);

  const sortBy = params.sortBy ?? "last_order_at";
  const ascending = params.sortDir === "asc";
  query = query.order(sortBy, { ascending, nullsFirst: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return {
    customers: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export interface QuickSearchResult {
  id: string;
  full_name: string;
  primary_phone: string | null;
  email: string | null;
  status: CustomerStatus;
}

// Backs the topbar's live-suggestions search box — same three fields
// (name/phone/order id) as the customers list's own search filter, just
// capped to a handful of results instead of a paginated list.
export async function quickSearchCustomers(query: string, limit = 8): Promise<QuickSearchResult[]> {
  const supabase = await createClient();
  const escaped = query.trim().replace(/[%,]/g, "");
  if (!escaped) return [];

  const { data, error } = await supabase
    .from("customer_list_view")
    .select("id, full_name, primary_phone, email, status")
    .is("deleted_at", null)
    .or(`full_name.ilike.%${escaped}%,primary_phone.ilike.%${escaped}%,order_ids.ilike.%${escaped}%`)
    .order("last_order_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAllTags() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tags").select("*").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAssignableEmployees() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name").eq("is_active", true).order("full_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Used by the referrer picker (Phase 11) — id/name only, excludes the
// customer being edited so nobody can set themselves as their own referrer.
export async function getCustomersLite(excludeId?: string) {
  const supabase = await createClient();
  let query = supabase.from("customers").select("id, full_name").is("deleted_at", null).order("full_name").limit(500);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}
