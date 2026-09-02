import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProvider } from "@/lib/integrations/core/registry";
import { providerSupports, type FetchPageResult } from "@/lib/integrations/core/provider";
import { validateNormalizedCustomer, validateNormalizedOrder } from "@/lib/integrations/types/schemas";
import { syncCustomer } from "@/lib/integrations/sync/customer-sync";
import { syncOrder } from "@/lib/integrations/sync/order-sync";
import type { SyncRunType, SyncRunStatus } from "@/lib/types/database";

export interface SyncRunSummary {
  syncRunId: string;
  status: SyncRunStatus;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errorSummary: string | null;
}

const BATCH_SIZE = 50;
const MAX_PAGES = 200; // hard stop so a misbehaving provider (nextCursor never null) can't loop forever

// How far before last_success_at each incremental sync re-fetches, to give
// CustomerNotSyncedError (main_system's own /customers list lagging /orders
// for very recent phones — see order-sync.ts) a real chance to retry.
// Learned live, the hard way: an earlier version of this file instead
// withheld advancing last_success_at on any "partially_failed" run — safe in
// theory, but this source has a *small, recurring* lag on nearly every run,
// so the cursor never advanced at all and every "incremental" sync silently
// became a full ~2000-order, ~50-minute re-fetch, every single hour,
// piling up. A fixed lookback keeps the fetch window small and fast while
// still covering the handful of records likely to have failed last time.
const RETRY_LOOKBACK_MS = 30 * 60 * 1000;

// Provider-independent entry point (Part 10): whatever eventually calls this
// — a "Sync Now" button, a cron job, Trigger.dev — goes through the exact
// same path, so scheduling is purely "who calls this function and when",
// never a second implementation of the sync logic.
export async function runIntegrationSync(
  integrationId: string,
  source: string,
  syncType: SyncRunType,
  triggeredBy: string | null = null,
): Promise<SyncRunSummary> {
  const supabase = createAdminClient();
  const provider = getProvider(source);

  const { data: run, error: runError } = await supabase
    .from("sync_runs")
    .insert({ integration_id: integrationId, source, sync_type: syncType, status: "running", triggered_by: triggeredBy })
    .select("id")
    .single();

  if (runError || !run) {
    throw new Error(`Failed to start sync run: ${runError?.message ?? "unknown error"}`);
  }

  const runId = run.id;
  let total = 0;
  let success = 0;
  let failed = 0;
  const errorMessages: string[] = [];

  // "Track progress" (Part 10): the run row is updated after every batch, not
  // just at the end, so a long sync's progress is visible on /sync-logs while
  // it's still going instead of only once it finishes.
  async function reportProgress() {
    await supabase
      .from("sync_runs")
      .update({ total_records: total, successful_records: success, failed_records: failed })
      .eq("id", runId);
  }

  async function recordItem(
    entityType: "customer" | "order",
    externalId: string,
    status: "success" | "failed",
    error?: string,
    customerId?: string,
    orderId?: string,
  ) {
    await supabase.from("sync_run_items").insert({
      sync_run_id: runId,
      entity_type: entityType,
      external_id: externalId,
      customer_id: customerId ?? null,
      order_id: orderId ?? null,
      status,
      error: error ?? null,
    });
  }

  try {
    if (providerSupports(provider, "fetchCustomers") && provider.fetchCustomers) {
      await paginateAndProcess(provider.fetchCustomers, {}, async (raw) => {
        total++;
        const validated = validateNormalizedCustomer(raw);
        if (!validated.success) {
          failed++;
          errorMessages.push(validated.error);
          await recordItem("customer", raw.externalId, "failed", validated.error);
          return;
        }
        try {
          const result = await syncCustomer(validated.data);
          success++;
          await recordItem("customer", validated.data.externalId, "success", undefined, result.customerId);
        } catch (error) {
          failed++;
          const message = error instanceof Error ? error.message : "Unknown error";
          errorMessages.push(message);
          await recordItem("customer", validated.data.externalId, "failed", message);
        }
      });
      await reportProgress();
    }

    const useIncremental = syncType === "scheduled" && providerSupports(provider, "fetchUpdatedOrders") && provider.fetchUpdatedOrders;
    const fetchOrdersFn = useIncremental ? provider.fetchUpdatedOrders : provider.fetchOrders;

    if (fetchOrdersFn) {
      const lastSuccessfulSync = useIncremental ? await getLastSuccessfulSync(integrationId) : null;
      const since = lastSuccessfulSync ? new Date(new Date(lastSuccessfulSync).getTime() - RETRY_LOOKBACK_MS).toISOString() : undefined;

      await paginateAndProcess(fetchOrdersFn, { since: since ?? undefined }, async (raw) => {
        total++;
        const validated = validateNormalizedOrder(raw);
        if (!validated.success) {
          failed++;
          errorMessages.push(validated.error);
          await recordItem("order", raw.externalId, "failed", validated.error);
          return;
        }
        try {
          const result = await syncOrder(validated.data);
          success++;
          await recordItem("order", validated.data.externalId, "success", undefined, result.customerId, result.orderId);
        } catch (error) {
          failed++;
          const message = error instanceof Error ? error.message : "Unknown error";
          errorMessages.push(message);
          await recordItem("order", validated.data.externalId, "failed", message);
        }
      });
      await reportProgress();
    }
  } catch (error) {
    // A failure outside the per-record loops (e.g. the provider itself threw).
    // Still falls through to close the run instead of leaving it "running".
    const message = error instanceof Error ? error.message : "Unknown error";
    errorMessages.push(message);
    if (total === 0) total = 1;
    failed = Math.max(failed, 1);
  }

  const status: SyncRunStatus = failed === 0 ? "completed" : success > 0 ? "partially_failed" : "failed";
  const now = new Date().toISOString();
  const errorSummary = errorMessages.length > 0 ? errorMessages.slice(0, 5).join(" | ") : null;

  await supabase
    .from("sync_runs")
    .update({
      status,
      total_records: total,
      successful_records: success,
      failed_records: failed,
      error_summary: errorSummary,
      finished_at: now,
    })
    .eq("id", runId);

  // last_success_at is the cursor the *next* incremental sync starts from
  // (minus RETRY_LOOKBACK_MS, above) — a "partially_failed" run still
  // advances it, same as "completed". CustomerNotSyncedError is retryable
  // (order-sync.ts) precisely because the lookback buffer re-covers it next
  // time, not because the cursor itself waits for a perfectly clean run —
  // withholding advancement here was tried first and made every
  // "incremental" sync balloon into a full historical re-fetch once this
  // source's small recurring lag meant a fully-clean run almost never
  // happened. Only a genuinely total failure (nothing synced at all) skips
  // advancing it.
  await supabase
    .from("integrations")
    .update(
      status !== "failed"
        ? { last_sync_at: now, last_success_at: now, status: "connected" }
        : { last_sync_at: now, last_failure_at: now, status: "error" },
    )
    .eq("id", integrationId);

  return { syncRunId: runId, status, totalRecords: total, successfulRecords: success, failedRecords: failed, errorSummary };
}

// Walks every page a fetch* method returns (Part 10's "process records in
// batches"), following nextCursor until hasMore is false. A provider that
// returns everything in one page (like the mock provider) is just the
// one-page case of the same loop.
async function paginateAndProcess<T>(
  fetchPage: (params: { since?: string; cursor?: string | null; limit?: number }) => Promise<FetchPageResult<T>>,
  baseParams: { since?: string },
  processRecord: (record: T) => Promise<void>,
): Promise<void> {
  let cursor: string | null = null;
  let hasMore = true;
  let pageCount = 0;

  while (hasMore && pageCount < MAX_PAGES) {
    const page = await fetchPage({ ...baseParams, cursor, limit: BATCH_SIZE });
    for (const record of page.records) {
      await processRecord(record);
    }
    hasMore = page.hasMore;
    cursor = page.nextCursor;
    pageCount++;
  }
}

async function getLastSuccessfulSync(integrationId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("integrations").select("last_success_at").eq("id", integrationId).single();
  return data?.last_success_at ?? null;
}
