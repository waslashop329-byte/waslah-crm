"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/services/audit-service";
import { scanForDuplicateCandidates } from "@/lib/intelligence/duplicates/duplicate-detection-service";
import { mergeCustomers } from "@/lib/intelligence/duplicates/merge-service";
import { analyzeDuplicateCandidate } from "@/lib/ai/services/duplicate-analysis-service";
import type { DuplicateAnalysisOutput } from "@/lib/ai/schemas/duplicate-analysis-schema";

export interface DuplicateActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

export interface DuplicateAnalysisState extends DuplicateActionState {
  result?: DuplicateAnalysisOutput;
}

const candidateIdSchema = z.object({ candidateId: z.string().uuid() });

const mergeSchema = z.object({
  primaryId: z.string().uuid(),
  secondaryId: z.string().uuid(),
  candidateId: z.string().uuid().optional(),
});

export async function ignoreDuplicateAction(_prevState: DuplicateActionState, formData: FormData): Promise<DuplicateActionState> {
  const user = await requirePermission("duplicates.merge");

  const parsed = candidateIdSchema.safeParse({ candidateId: formData.get("candidateId") });
  if (!parsed.success) return { error: "Invalid candidate" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("duplicate_candidates")
    .update({ status: "ignored", resolved_at: new Date().toISOString(), resolved_by: user.userId })
    .eq("id", parsed.data.candidateId);

  if (error) return { error: error.message };

  await recordAudit({
    actorId: user.userId,
    action: "duplicate_candidate.ignored",
    entityType: "duplicate_candidate",
    entityId: parsed.data.candidateId,
  });

  revalidatePath("/duplicates");
  return { success: true };
}

export async function scanForDuplicatesAction(): Promise<DuplicateActionState> {
  const user = await requirePermission("duplicates.merge");

  try {
    const result = await scanForDuplicateCandidates();

    await recordAudit({
      actorId: user.userId,
      action: "duplicate_scan.run",
      entityType: "duplicate_candidates",
      entityId: "scan",
      afterData: { pairsEvaluated: result.pairsEvaluated, candidatesRecorded: result.candidatesRecorded },
    });

    revalidatePath("/duplicates");
    return { success: true, message: `Scanned ${result.pairsEvaluated} pairs, ${result.candidatesRecorded} candidates flagged` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Scan failed" };
  }
}

export async function mergeCustomersAction(_prevState: DuplicateActionState, formData: FormData): Promise<DuplicateActionState> {
  const user = await requirePermission("duplicates.merge");

  const parsed = mergeSchema.safeParse({
    primaryId: formData.get("primaryId"),
    secondaryId: formData.get("secondaryId"),
    candidateId: formData.get("candidateId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    const summary = await mergeCustomers(parsed.data.primaryId, parsed.data.secondaryId, user.userId, parsed.data.candidateId);
    revalidatePath("/duplicates");
    revalidatePath(`/customers/${parsed.data.primaryId}`);
    return {
      success: true,
      message: `Merged: ${summary.orders_moved} orders, ${summary.notes_moved} notes, ${summary.events_moved} timeline events preserved`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Merge failed" };
  }
}

export async function analyzeDuplicateAction(_prevState: DuplicateAnalysisState, formData: FormData): Promise<DuplicateAnalysisState> {
  const user = await requirePermission("duplicates.view");

  const parsed = candidateIdSchema.safeParse({ candidateId: formData.get("candidateId") });
  if (!parsed.success) return { error: "Invalid candidate" };

  try {
    const result = await analyzeDuplicateCandidate(parsed.data.candidateId, user.userId);
    return { success: true, result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Analysis failed" };
  }
}
