import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { DuplicateCandidateRow } from "@/lib/types/database";

export interface DuplicateCandidateWithCustomers extends DuplicateCandidateRow {
  customerA: { id: string; full_name: string; email: string | null } | null;
  customerB: { id: string; full_name: string; email: string | null } | null;
}

export interface DuplicateListParams {
  status?: "pending" | "ignored" | "merged";
  minConfidence?: number;
  page?: number;
  pageSize?: number;
}

export interface DuplicateListResult {
  candidates: DuplicateCandidateWithCustomers[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;

export async function listDuplicateCandidates(params: DuplicateListParams): Promise<DuplicateListResult> {
  const supabase = await createClient();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("duplicate_candidates").select("*", { count: "exact" });

  if (params.status) query = query.eq("status", params.status);
  if (params.minConfidence !== undefined) query = query.gte("confidence_score", params.minConfidence);

  query = query.order("confidence_score", { ascending: false }).range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const candidateRows = data ?? [];
  const customerIds = Array.from(new Set(candidateRows.flatMap((c) => [c.customer_id_a, c.customer_id_b])));

  const { data: customers } = customerIds.length > 0
    ? await supabase.from("customers").select("id, full_name, email").in("id", customerIds)
    : { data: [] };

  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));

  const candidates: DuplicateCandidateWithCustomers[] = candidateRows.map((row) => ({
    ...row,
    customerA: customerById.get(row.customer_id_a) ?? null,
    customerB: customerById.get(row.customer_id_b) ?? null,
  }));

  return { candidates, total: count ?? 0, page, pageSize };
}
