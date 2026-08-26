import "server-only";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/services/audit-service";
import type { ProductRow } from "@/lib/types/database";

interface ProductInput {
  name: string;
  sku: string | null;
  category: string | null;
  defaultPrice: number;
  costPrice: number | null;
}

// RLS-scoped (not the admin client): every caller here is a signed-in user
// hitting this through a server action already gated by requirePermission,
// and the products_write RLS policy provides the same is_full_access() gate
// as a second layer — matches settings/actions.ts, not the sync engine's
// no-session use of the admin client.
export async function createProduct(actorId: string, input: ProductInput): Promise<ProductRow> {
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name: input.name,
      sku: input.sku,
      category: input.category,
      default_price: input.defaultPrice,
      cost_price: input.costPrice,
    })
    .select()
    .single();

  if (error || !product) throw new Error(error?.message ?? "Failed to create product");

  await recordAudit({
    actorId,
    action: "product.created",
    entityType: "product",
    entityId: product.id,
    afterData: { name: product.name, default_price: product.default_price, cost_price: product.cost_price },
  });

  return product;
}

export async function updateProduct(actorId: string, productId: string, input: ProductInput): Promise<ProductRow> {
  const supabase = await createClient();
  const { data: before } = await supabase.from("products").select("*").eq("id", productId).single();

  const { data: product, error } = await supabase
    .from("products")
    .update({
      name: input.name,
      sku: input.sku,
      category: input.category,
      default_price: input.defaultPrice,
      cost_price: input.costPrice,
    })
    .eq("id", productId)
    .select()
    .single();

  if (error || !product) throw new Error(error?.message ?? "Failed to update product");

  await recordAudit({
    actorId,
    action: "product.updated",
    entityType: "product",
    entityId: product.id,
    beforeData: before ? { name: before.name, default_price: before.default_price, cost_price: before.cost_price } : null,
    afterData: { name: product.name, default_price: product.default_price, cost_price: product.cost_price },
  });

  return product;
}

export async function setProductActive(actorId: string, productId: string, isActive: boolean): Promise<ProductRow> {
  const supabase = await createClient();

  const { data: product, error } = await supabase.from("products").update({ is_active: isActive }).eq("id", productId).select().single();
  if (error || !product) throw new Error(error?.message ?? "Failed to update product");

  await recordAudit({
    actorId,
    action: isActive ? "product.activated" : "product.deactivated",
    entityType: "product",
    entityId: product.id,
    afterData: { is_active: isActive },
  });

  return product;
}
