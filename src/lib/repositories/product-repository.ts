import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductRow } from "@/lib/types/database";

export async function listProducts(includeInactive = true): Promise<ProductRow[]> {
  const supabase = await createClient();
  let query = supabase.from("products").select("*").order("name");
  if (!includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProduct(productId: string): Promise<ProductRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
  return data ?? null;
}
