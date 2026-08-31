import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateNormalizedCustomer, validateNormalizedOrder, validateImportedProduct } from "@/lib/integrations/types/schemas";
import { syncCustomer } from "@/lib/integrations/sync/customer-sync";
import { syncOrder } from "@/lib/integrations/sync/order-sync";
import { upsertImportedProduct } from "@/lib/services/product-import-service";
import { IMPORT_SOURCE } from "@/lib/import/customer-row-mapper";
import type { NormalizedCustomer, NormalizedOrder } from "@/lib/integrations/types/normalized";
import type { ImportedProduct } from "@/lib/import/product-row-mapper";

export interface DataImportSummary {
  syncRunId: string;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errors: string[];
}

// Same bookkeeping shape as runIntegrationSync() (Part 10) — one sync_runs
// row + one sync_run_items row per record, so an Excel import shows up on
// /sync-logs exactly like an API sync would, with the same per-row
// success/failure detail. Simpler than runIntegrationSync itself: no
// provider/pagination abstraction, since the rows are already an in-memory
// array the caller parsed client-side and is now re-validating server-side.
async function startSyncRun(): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sync_runs")
    .insert({ integration_id: null, source: IMPORT_SOURCE, sync_type: "manual", status: "running" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Failed to start import run: ${error?.message ?? "unknown error"}`);
  return data.id;
}

async function finishSyncRun(syncRunId: string, total: number, success: number, failed: number, errors: string[]): Promise<void> {
  const supabase = createAdminClient();
  const status = failed === 0 ? "completed" : success > 0 ? "partially_failed" : "failed";
  await supabase
    .from("sync_runs")
    .update({
      status,
      total_records: total,
      successful_records: success,
      failed_records: failed,
      error_summary: errors.length > 0 ? errors.slice(0, 5).join(" | ") : null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", syncRunId);
}

async function recordItem(
  syncRunId: string,
  entityType: "customer" | "order" | "product",
  externalId: string | null,
  status: "success" | "failed",
  error?: string,
  customerId?: string,
  orderId?: string,
): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("sync_run_items").insert({
    sync_run_id: syncRunId,
    entity_type: entityType,
    external_id: externalId,
    customer_id: customerId ?? null,
    order_id: orderId ?? null,
    status,
    error: error ?? null,
  });
}

export async function runCustomerDataImport(customers: NormalizedCustomer[]): Promise<DataImportSummary> {
  const syncRunId = await startSyncRun();
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const customer of customers) {
    const validated = validateNormalizedCustomer(customer);
    if (!validated.success) {
      failed++;
      errors.push(validated.error);
      await recordItem(syncRunId, "customer", customer.externalId, "failed", validated.error);
      continue;
    }
    try {
      const result = await syncCustomer(validated.data);
      success++;
      await recordItem(syncRunId, "customer", validated.data.externalId, "success", undefined, result.customerId);
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(message);
      await recordItem(syncRunId, "customer", customer.externalId, "failed", message);
    }
  }

  await finishSyncRun(syncRunId, customers.length, success, failed, errors);
  return { syncRunId, totalRecords: customers.length, successfulRecords: success, failedRecords: failed, errors };
}

export async function runProductDataImport(products: ImportedProduct[]): Promise<DataImportSummary> {
  const syncRunId = await startSyncRun();
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const product of products) {
    const validated = validateImportedProduct(product);
    if (!validated.success) {
      failed++;
      errors.push(validated.error);
      await recordItem(syncRunId, "product", product.sku, "failed", validated.error);
      continue;
    }
    try {
      await upsertImportedProduct(validated.data);
      success++;
      await recordItem(syncRunId, "product", product.sku, "success");
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(message);
      await recordItem(syncRunId, "product", product.sku, "failed", message);
    }
  }

  await finishSyncRun(syncRunId, products.length, success, failed, errors);
  return { syncRunId, totalRecords: products.length, successfulRecords: success, failedRecords: failed, errors };
}

export interface OrderImportRow {
  customer: NormalizedCustomer;
  order: NormalizedOrder;
}

export async function runOrderDataImport(rows: OrderImportRow[]): Promise<DataImportSummary> {
  const syncRunId = await startSyncRun();
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const customerValidated = validateNormalizedCustomer(row.customer);
    const orderValidated = validateNormalizedOrder(row.order);

    if (!customerValidated.success || !orderValidated.success) {
      const message = !customerValidated.success ? customerValidated.error : (orderValidated as { error: string }).error;
      failed++;
      errors.push(message);
      await recordItem(syncRunId, "order", row.order.externalId, "failed", message);
      continue;
    }

    try {
      // The order's customer is synced first, right here — not in a
      // separate step — so an order row is always self-sufficient even if
      // no dedicated Customers sheet was ever imported for this person.
      // syncCustomer() is idempotent (matches by phone), so a phone number
      // repeated across many order rows just resolves to the same customer.
      const customerResult = await syncCustomer(customerValidated.data);
      const orderResult = await syncOrder(orderValidated.data);
      success++;
      await recordItem(syncRunId, "order", orderValidated.data.externalId, "success", undefined, customerResult.customerId, orderResult.orderId);
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : "Unknown error";
      errors.push(message);
      await recordItem(syncRunId, "order", row.order.externalId, "failed", message);
    }
  }

  await finishSyncRun(syncRunId, rows.length, success, failed, errors);
  return { syncRunId, totalRecords: rows.length, successfulRecords: success, failedRecords: failed, errors };
}
