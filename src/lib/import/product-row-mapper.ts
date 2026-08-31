import { readColumn, type ParsedRow } from "@/lib/import/spreadsheet-parser";
import type { RowMapResult } from "@/lib/import/customer-row-mapper";

export interface ImportedProduct {
  name: string;
  sku: string | null;
  category: string | null;
  defaultPrice: number;
  costPrice: number | null;
}

export function mapProductRow(row: ParsedRow): RowMapResult<ImportedProduct> {
  const name = readColumn(row, "Name", "Product Name", "اسم المنتج", "الاسم");
  const sku = readColumn(row, "SKU", "رمز المنتج");
  const category = readColumn(row, "Category", "التصنيف", "الفئة");
  const priceRaw = readColumn(row, "Price", "Default Price", "السعر");
  const costRaw = readColumn(row, "Cost", "Cost Price", "التكلفة");

  if (!name) return { success: false, error: "Missing product name" };

  if (!priceRaw) return { success: false, error: "Missing price" };
  const defaultPrice = Number(priceRaw);
  if (!Number.isFinite(defaultPrice) || defaultPrice < 0) return { success: false, error: `Invalid price "${priceRaw}"` };

  let costPrice: number | null = null;
  if (costRaw) {
    costPrice = Number(costRaw);
    if (!Number.isFinite(costPrice) || costPrice < 0) return { success: false, error: `Invalid cost "${costRaw}"` };
  }

  return { success: true, data: { name, sku: sku || null, category: category || null, defaultPrice, costPrice } };
}
