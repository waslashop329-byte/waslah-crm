"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { createExperiment, recordExperimentResult } from "@/lib/services/experiments-service";

export interface AnalyticsActionState {
  error?: string;
  success?: boolean;
}

const createExperimentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  category: z.enum(["product_page", "creative", "offer", "confirmation_script", "upsell"]),
  hypothesis: z.string().trim().max(500).optional(),
  variantAName: z.string().trim().min(1, "Variant A name is required").max(80),
  variantBName: z.string().trim().min(1, "Variant B name is required").max(80),
  metricLabel: z.string().trim().min(1).max(80),
});

export async function createExperimentAction(_prevState: AnalyticsActionState, formData: FormData): Promise<AnalyticsActionState> {
  const user = await requirePermission("experiments.manage");

  const parsed = createExperimentSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    hypothesis: formData.get("hypothesis") || undefined,
    variantAName: formData.get("variantAName"),
    variantBName: formData.get("variantBName"),
    metricLabel: formData.get("metricLabel") || "Conversion rate (%)",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await createExperiment(user.userId, {
      name: parsed.data.name,
      category: parsed.data.category,
      hypothesis: parsed.data.hypothesis ?? null,
      variantAName: parsed.data.variantAName,
      variantBName: parsed.data.variantBName,
      metricLabel: parsed.data.metricLabel,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create experiment" };
  }

  revalidatePath("/analytics");
  return { success: true };
}

const recordResultSchema = z.object({
  experimentId: z.string().uuid(),
  variantAMetricValue: z.coerce.number().optional(),
  variantBMetricValue: z.coerce.number().optional(),
  status: z.enum(["running", "completed"]),
  winner: z.enum(["a", "b", "inconclusive"]).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function recordExperimentResultAction(_prevState: AnalyticsActionState, formData: FormData): Promise<AnalyticsActionState> {
  const user = await requirePermission("experiments.manage");

  const parsed = recordResultSchema.safeParse({
    experimentId: formData.get("experimentId"),
    variantAMetricValue: formData.get("variantAMetricValue") || undefined,
    variantBMetricValue: formData.get("variantBMetricValue") || undefined,
    status: formData.get("status"),
    winner: formData.get("winner") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await recordExperimentResult(user.userId, parsed.data.experimentId, {
      variantAMetricValue: parsed.data.variantAMetricValue ?? null,
      variantBMetricValue: parsed.data.variantBMetricValue ?? null,
      status: parsed.data.status,
      winner: parsed.data.winner ?? null,
      notes: parsed.data.notes ?? null,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to record result" };
  }

  revalidatePath("/analytics");
  return { success: true };
}
