import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { FollowUpRow, FollowUpStatus } from "@/lib/types/database";

export type FollowUpListSortColumn = "due_date" | "created_at";

export interface FollowUpListParams {
  status?: FollowUpStatus;
  overdueOnly?: boolean;
  sortBy?: FollowUpListSortColumn;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface FollowUpListRow extends FollowUpRow {
  customer_full_name: string;
}

export interface FollowUpListResult {
  followUps: FollowUpListRow[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;

// Global follow-ups queue backing the /follow-ups page — this was a Phase 2
// stub (PhasePlaceholder) ever since Phase 2 was skipped in favor of jumping
// to Customer 360; the dashboard's "Pending/Overdue Follow-ups" KPIs finally
// give it a reason to exist as a real page instead of a placeholder.
export async function listFollowUps(params: FollowUpListParams): Promise<FollowUpListResult> {
  const supabase = await createClient();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("follow_ups").select("*, customers(full_name)", { count: "exact" });

  if (params.overdueOnly) {
    query = query.eq("status", "pending").lt("due_date", new Date().toISOString());
  } else if (params.status) {
    query = query.eq("status", params.status);
  }

  const sortBy = params.sortBy ?? "due_date";
  const ascending = params.sortDir === "asc";
  query = query.order(sortBy, { ascending }).range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  return {
    followUps: (data ?? []).map((row) => {
      const { customers, ...followUp } = row as unknown as FollowUpRow & { customers: { full_name: string } | null };
      return { ...followUp, customer_full_name: customers?.full_name ?? "Unknown customer" };
    }),
    total: count ?? 0,
    page,
    pageSize,
  };
}
