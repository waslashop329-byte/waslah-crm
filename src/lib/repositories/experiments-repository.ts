import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ExperimentRow } from "@/lib/types/database";

export async function listExperiments(): Promise<ExperimentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("experiments").select("*").order("started_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
