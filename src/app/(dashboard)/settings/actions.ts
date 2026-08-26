"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/services/audit-service";
import { updateLoyaltyTier } from "@/lib/services/loyalty-service";
import { updatePerformanceConfig } from "@/lib/services/performance-service";

export interface SettingsActionState {
  error?: string;
  success?: boolean;
}

const scoringRuleSchema = z.object({
  ruleId: z.string().uuid(),
  weight: z.coerce.number(),
  threshold: z.coerce.number().optional(),
  isActive: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export async function updateScoringRuleAction(_prevState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const user = await requirePermission("scores.configure");

  const parsed = scoringRuleSchema.safeParse({
    ruleId: formData.get("ruleId"),
    weight: formData.get("weight"),
    threshold: formData.get("threshold") || undefined,
    isActive: formData.get("isActive") ?? "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data: before } = await supabase.from("scoring_rules").select("*").eq("id", parsed.data.ruleId).single();

  const { error } = await supabase
    .from("scoring_rules")
    .update({ weight: parsed.data.weight, threshold: parsed.data.threshold ?? null, is_active: parsed.data.isActive })
    .eq("id", parsed.data.ruleId);

  if (error) return { error: error.message };

  await recordAudit({
    actorId: user.userId,
    action: "scoring_rule.updated",
    entityType: "scoring_rule",
    entityId: parsed.data.ruleId,
    beforeData: before ? { weight: before.weight, threshold: before.threshold, is_active: before.is_active } : null,
    afterData: { weight: parsed.data.weight, threshold: parsed.data.threshold ?? null, is_active: parsed.data.isActive },
  });

  revalidatePath("/settings");
  return { success: true };
}

const thresholdSchema = z.object({
  thresholdId: z.string().uuid(),
  minScore: z.coerce.number().min(0).max(100),
});

export async function updateThresholdAction(_prevState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const user = await requirePermission("scores.configure");

  const parsed = thresholdSchema.safeParse({ thresholdId: formData.get("thresholdId"), minScore: formData.get("minScore") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data: before } = await supabase.from("score_category_thresholds").select("*").eq("id", parsed.data.thresholdId).single();

  const { error } = await supabase
    .from("score_category_thresholds")
    .update({ min_score: parsed.data.minScore })
    .eq("id", parsed.data.thresholdId);

  if (error) return { error: error.message };

  await recordAudit({
    actorId: user.userId,
    action: "score_threshold.updated",
    entityType: "score_category_threshold",
    entityId: parsed.data.thresholdId,
    beforeData: before ? { min_score: before.min_score } : null,
    afterData: { min_score: parsed.data.minScore },
  });

  revalidatePath("/settings");
  return { success: true };
}

const loyaltyTierSchema = z.object({
  tierId: z.string().uuid(),
  minOrders: z.coerce.number().min(0),
  minSpend: z.coerce.number().min(0),
  benefits: z.string().trim().max(300).optional(),
});

export async function updateLoyaltyTierAction(_prevState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const user = await requirePermission("loyalty.manage");

  const parsed = loyaltyTierSchema.safeParse({
    tierId: formData.get("tierId"),
    minOrders: formData.get("minOrders"),
    minSpend: formData.get("minSpend"),
    benefits: formData.get("benefits") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await updateLoyaltyTier(user.userId, parsed.data.tierId, parsed.data.minOrders, parsed.data.minSpend, parsed.data.benefits ?? null);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update tier" };
  }

  revalidatePath("/settings");
  return { success: true };
}

const performanceConfigSchema = z.object({
  configId: z.string().uuid(),
  commissionRatePercent: z.coerce.number().min(0).max(100),
  xpPerConfirmedOrder: z.coerce.number().min(0),
  xpPerCompletedFollowup: z.coerce.number().min(0),
});

export async function updatePerformanceConfigAction(_prevState: SettingsActionState, formData: FormData): Promise<SettingsActionState> {
  const user = await requirePermission("performance.manage");

  const parsed = performanceConfigSchema.safeParse({
    configId: formData.get("configId"),
    commissionRatePercent: formData.get("commissionRatePercent"),
    xpPerConfirmedOrder: formData.get("xpPerConfirmedOrder"),
    xpPerCompletedFollowup: formData.get("xpPerCompletedFollowup"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await updatePerformanceConfig(user.userId, parsed.data.configId, parsed.data.commissionRatePercent, parsed.data.xpPerConfirmedOrder, parsed.data.xpPerCompletedFollowup);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update config" };
  }

  revalidatePath("/settings");
  return { success: true };
}
