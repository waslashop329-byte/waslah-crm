import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { IntegrationRow, SyncRunRow } from "@/lib/types/database";

export interface IntegrationWithHealth extends IntegrationRow {
  lastRun: SyncRunRow | null;
}

export async function listIntegrations(): Promise<IntegrationWithHealth[]> {
  const supabase = await createClient();

  const { data: integrations, error } = await supabase.from("integrations").select("*").order("name");
  if (error) throw new Error(error.message);
  if (!integrations || integrations.length === 0) return [];

  const { data: runs } = await supabase
    .from("sync_runs")
    .select("*")
    .in(
      "integration_id",
      integrations.map((i) => i.id),
    )
    .order("started_at", { ascending: false });

  const latestRunByIntegration = new Map<string, SyncRunRow>();
  for (const run of runs ?? []) {
    if (run.integration_id && !latestRunByIntegration.has(run.integration_id)) {
      latestRunByIntegration.set(run.integration_id, run);
    }
  }

  return integrations.map((integration) => ({
    ...integration,
    lastRun: latestRunByIntegration.get(integration.id) ?? null,
  }));
}

export async function getIntegration(integrationId: string): Promise<IntegrationRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("integrations").select("*").eq("id", integrationId).maybeSingle();
  return data ?? null;
}
