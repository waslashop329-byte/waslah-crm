import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Pure — mirrors applyStatusMapping() in order-status-mapper.ts.
export function applyProductMapping(mappings: Record<string, string>, externalProductText: string): string | null {
  return mappings[externalProductText] ?? null;
}

// Cached per source, same lifetime/invalidation story as the status mapper.
const mappingCache = new Map<string, Record<string, string>>();

async function loadProductMappingsForSource(source: string): Promise<Record<string, string>> {
  if (mappingCache.has(source)) return mappingCache.get(source)!;

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("external_product_mappings").select("external_product_text, product_id").eq("source", source);

  if (error) {
    throw new Error(`Failed to load product mappings for "${source}": ${error.message}`);
  }

  const mapping: Record<string, string> = {};
  for (const row of data ?? []) {
    mapping[row.external_product_text] = row.product_id;
  }

  mappingCache.set(source, mapping);
  return mapping;
}

export function clearProductMappingCache(source?: string): void {
  if (source) mappingCache.delete(source);
  else mappingCache.clear();
}

export async function mapExternalProduct(source: string, externalProductText: string): Promise<string | null> {
  const mappings = await loadProductMappingsForSource(source);
  return applyProductMapping(mappings, externalProductText);
}
