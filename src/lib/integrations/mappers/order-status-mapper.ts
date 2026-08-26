import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NormalizedOrderStatus } from "@/lib/integrations/types/normalized";

// Pure — no DB access — so it's unit-testable on its own. The DB-backed
// resolver below just loads a `Record<externalStatus, internalStatus>` once
// and hands it to this function.
export function applyStatusMapping(
  mappings: Record<string, NormalizedOrderStatus>,
  externalStatus: string,
  fallback: NormalizedOrderStatus = "pending",
): NormalizedOrderStatus {
  return mappings[externalStatus] ?? fallback;
}

// Cached per source for the lifetime of the process — sync runs call this a
// lot and the mapping table changes rarely.
const mappingCache = new Map<string, Record<string, NormalizedOrderStatus>>();

async function loadMappingsForSource(source: string): Promise<Record<string, NormalizedOrderStatus>> {
  if (mappingCache.has(source)) return mappingCache.get(source)!;

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("external_status_mappings").select("external_status, internal_status").eq("source", source);

  if (error) {
    throw new Error(`Failed to load status mappings for "${source}": ${error.message}`);
  }

  const mapping: Record<string, NormalizedOrderStatus> = {};
  for (const row of data ?? []) {
    mapping[row.external_status] = row.internal_status;
  }

  mappingCache.set(source, mapping);
  return mapping;
}

export function clearStatusMappingCache(source?: string): void {
  if (source) mappingCache.delete(source);
  else mappingCache.clear();
}

export async function mapExternalStatus(source: string, externalStatus: string): Promise<NormalizedOrderStatus> {
  const mappings = await loadMappingsForSource(source);
  return applyStatusMapping(mappings, externalStatus);
}
