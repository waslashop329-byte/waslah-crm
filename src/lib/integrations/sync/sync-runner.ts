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
      const since = useIncremental ? await getLastSuccessfulSync(integrationId) : undefined;

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
  // (fetchUpdatedOrders({ since: last_success_at })) — advancing it past a
  // "partially_failed" run would permanently skip the records that failed:
  // CustomerNotSyncedError is explicitly RetryableIntegrationError, meaning
  // "the customer just hasn't synced yet, a later retry can succeed" (see
  // its docstring in order-sync.ts) — but that retry only actually happens
  // if this run's window is still covered by the *next* run. Found live:
  // 9 of 1164 orders failed with CustomerNotSyncedError on the real
  // main_system data (the source's own /customers list appears to lag
  // /orders slightly for very recent phones), and the old code would have
  // advanced last_success_at anyway, silently losing those 9 orders forever.
  // Only a fully clean run advances the cursor; a partial failure still
  // updates last_sync_at (so /sync-logs reflects the attempt) but leaves
  // last_success_at where it was, so the next scheduled run's window still
  // includes the records that failed and retries them for free — syncOrder/
  // syncCustomer are idempotent, so re-processing the ones that already
  // succeeded is harmless, just repeated work.
  await supabase
    .from("integrations")
    .update(
      status === "completed"
        ? { last_sync_at: now, last_success_at: now, status: "connected" }
        : status === "partially_failed"
          ? { last_sync_at: now, status: "connected" }
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
