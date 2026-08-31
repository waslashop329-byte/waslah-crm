"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { runCustomerDataImport, runProductDataImport, runOrderDataImport, type DataImportSummary, type OrderImportRow } from "@/lib/services/data-import-service";
import type { NormalizedCustomer } from "@/lib/integrations/types/normalized";
import type { ImportedProduct } from "@/lib/import/product-row-mapper";

export interface ImportActionResult {
  success: boolean;
  summary?: DataImportSummary;
  error?: string;
}

// Plain callable server actions (not <form action>-bound) — the client
// component parses the uploaded file and maps every row itself first (for
// the instant preview), then hands the same already-mapped rows here to
// commit. Same permission as the API-sync engine: bulk data ingestion is
// the same trust tier either way.

export async function commitCustomerImportAction(customers: NormalizedCustomer[]): Promise<ImportActionResult> {
  await requirePermission("integrations.manage");
  if (customers.length === 0) return { success: false, error: "No valid rows to import" };

  try {
    const summary = await runCustomerDataImport(customers);
    revalidatePath("/customers");
    revalidatePath("/sync-logs");
    return { success: true, summary };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Import failed" };
  }
}

export async function commitProductImportAction(products: ImportedProduct[]): Promise<ImportActionResult> {
  await requirePermission("integrations.manage");
  if (products.length === 0) return { success: false, error: "No valid rows to import" };

  try {
    const summary = await runProductDataImport(products);
    revalidatePath("/products");
    revalidatePath("/sync-logs");
    return { success: true, summary };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Import failed" };
  }
}

export async function commitOrderImportAction(rows: OrderImportRow[]): Promise<ImportActionResult> {
  await requirePermission("integrations.manage");
  if (rows.length === 0) return { success: false, error: "No valid rows to import" };

  try {
    const summary = await runOrderDataImport(rows);
    revalidatePath("/customers");
    revalidatePath("/orders");
    revalidatePath("/sync-logs");
    return { success: true, summary };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Import failed" };
  }
}
