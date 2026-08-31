import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ImportedProduct } from "@/lib/import/product-row-mapper";

export interface ProductImportResult {
  productId: string;
  created: boolean;
}

// Products aren't part of the customer/order sync pipeline (no external-id
// matching table for them), so this mirrors that pipeline's shape at a
// smaller scale: match by SKU when given (the only stable, business-owned
// identifier a product row can carry) and upsert; with no SKU, always
// create — matching on name alone risks silently merging two different
// products that just happen to share a label.
export async function upsertImportedProduct(product: ImportedProduct): Promise<ProductImportResult> {
  const supabase = createAdminClient();

  if (product.sku) {
    const { data: existing } = await supabase.from("products").select("id").eq("sku", product.sku).maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("products")
        .update({ name: product.name, category: product.category, default_price: product.defaultPrice, cost_price: product.costPrice })
        .eq("id", existing.id);
      if (error) throw new Error(`Failed to update product: ${error.message}`);
      return { productId: existing.id, created: false };
    }
  }

  const { data: created, error } = await supabase
    .from("products")
    .insert({ name: product.name, sku: product.sku, category: product.category, default_price: product.defaultPrice, cost_price: product.costPrice })
    .select("id")
    .single();

  if (error || !created) throw new Error(`Failed to create product: ${error?.message ?? "unknown error"}`);
  return { productId: created.id, created: true };
}
