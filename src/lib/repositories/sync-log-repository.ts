import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SyncRunRow, SyncRunStatus, SyncRunItemRow, WebhookEventRow } from "@/lib/types/database";

export interface SyncRunListParams {
  integrationId?: string;
  status?: SyncRunStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface SyncRunListResult {
  runs: SyncRunRow[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 20;

export async function listSyncRuns(params: SyncRunListParams): Promise<SyncRunListResult> {
  const supabase = await createClient();

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("sync_runs").select("*", { count: "exact" });

  if (params.integrationId) query = query.eq("integration_id", params.integrationId);
  if (params.status) query = query.eq("status", params.status);
  if (params.dateFrom) query = query.gte("started_at", params.dateFrom);
  if (params.dateTo) query = query.lte("started_at", params.dateTo);

  query = query.order("started_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  return { runs: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getSyncRun(runId: string): Promise<SyncRunRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("sync_runs").select("*").eq("id", runId).maybeSingle();
  return data ?? null;
}

export async function listSyncRunItems(runId: string): Promise<SyncRunItemRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sync_run_items").select("*").eq("sync_run_id", runId).order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listFailedWebhookEvents(limit = 20): Promise<WebhookEventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webhook_events")
    .select("*")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
