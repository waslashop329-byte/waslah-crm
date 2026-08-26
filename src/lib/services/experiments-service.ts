import "server-only";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/services/audit-service";
import type { ExperimentRow } from "@/lib/types/database";

interface ExperimentInput {
  name: string;
  category: string;
  hypothesis: string | null;
  variantAName: string;
  variantBName: string;
  metricLabel: string;
}

export async function createExperiment(actorId: string, input: ExperimentInput): Promise<ExperimentRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("experiments")
    .insert({
      name: input.name,
      category: input.category,
      hypothesis: input.hypothesis,
      variant_a_name: input.variantAName,
      variant_b_name: input.variantBName,
      metric_label: input.metricLabel,
      created_by: actorId,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to create experiment");

  await recordAudit({ actorId, action: "experiment.created", entityType: "experiment", entityId: data.id, afterData: { name: data.name } });
  return data;
}

interface RecordResultInput {
  variantAMetricValue: number | null;
  variantBMetricValue: number | null;
  status: "running" | "completed";
  winner: string | null;
  notes: string | null;
}

export async function recordExperimentResult(actorId: string, experimentId: string, input: RecordResultInput): Promise<ExperimentRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("experiments")
    .update({
      variant_a_metric_value: input.variantAMetricValue,
      variant_b_metric_value: input.variantBMetricValue,
      status: input.status,
      winner: input.winner,
      notes: input.notes,
      ended_at: input.status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", experimentId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to update experiment");

  await recordAudit({ actorId, action: "experiment.result_recorded", entityType: "experiment", entityId: experimentId, afterData: { status: input.status, winner: input.winner } });
  return data;
}
