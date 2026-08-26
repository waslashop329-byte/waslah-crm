"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/services/audit-service";
import { validateSegmentConditions } from "@/lib/intelligence/segments/segment-schema";
import { countSegmentMembers } from "@/lib/intelligence/segments/segment-evaluator";

export interface SegmentActionState {
  error?: string;
  success?: boolean;
  previewCount?: number;
}

const segmentFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  conditionsJson: z.string().min(1),
});

async function parseSegmentForm(formData: FormData) {
  const parsed = segmentFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    conditionsJson: formData.get("conditionsJson"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" } as const;

  let rawConditions: unknown;
  try {
    rawConditions = JSON.parse(parsed.data.conditionsJson);
  } catch {
    return { error: "Invalid rule format" } as const;
  }

  const conditionsResult = validateSegmentConditions(rawConditions);
  if (!conditionsResult.success) return { error: conditionsResult.error } as const;

  return { success: true, name: parsed.data.name, description: parsed.data.description || null, conditions: conditionsResult.data } as const;
}

export async function previewSegmentAction(_prevState: SegmentActionState, formData: FormData): Promise<SegmentActionState> {
  await requirePermission("segments.view");

  const conditionsJson = formData.get("conditionsJson");
  if (typeof conditionsJson !== "string") return { error: "Missing rules" };

  let rawConditions: unknown;
  try {
    rawConditions = JSON.parse(conditionsJson);
  } catch {
    return { error: "Invalid rule format" };
  }

  const result = validateSegmentConditions(rawConditions);
  if (!result.success) return { error: result.error };

  try {
    const count = await countSegmentMembers(result.data);
    return { success: true, previewCount: count };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Preview failed" };
  }
}

export async function createSegmentAction(_prevState: SegmentActionState, formData: FormData): Promise<SegmentActionState> {
  const user = await requirePermission("segments.manage");

  const parsed = await parseSegmentForm(formData);
  if (!parsed.success) return { error: parsed.error };

  const supabase = await createClient();

  const { data: segment, error } = await supabase
    .from("segments")
    .insert({ name: parsed.name, description: parsed.description, is_dynamic: true, is_system: false, created_by: user.userId })
    .select("id")
    .single();

  if (error || !segment) return { error: error?.message ?? "Failed to create segment" };

  await supabase.from("segment_rules").insert({ segment_id: segment.id, conditions: parsed.conditions });

  await recordAudit({
    actorId: user.userId,
    action: "segment.created",
    entityType: "segment",
    entityId: segment.id,
    afterData: { name: parsed.name, conditions: parsed.conditions },
  });

  revalidatePath("/segments");
  redirect("/segments");
}

const segmentIdSchema = z.object({ segmentId: z.string().uuid() });

export async function updateSegmentAction(_prevState: SegmentActionState, formData: FormData): Promise<SegmentActionState> {
  const user = await requirePermission("segments.manage");

  const idParsed = segmentIdSchema.safeParse({ segmentId: formData.get("segmentId") });
  if (!idParsed.success) return { error: "Invalid segment" };

  const parsed = await parseSegmentForm(formData);
  if (!parsed.success) return { error: parsed.error };

  const supabase = await createClient();

  const { data: before } = await supabase.from("segments").select("name, description").eq("id", idParsed.data.segmentId).single();

  const { error } = await supabase
    .from("segments")
    .update({ name: parsed.name, description: parsed.description })
    .eq("id", idParsed.data.segmentId);
  if (error) return { error: error.message };

  await supabase.from("segment_rules").delete().eq("segment_id", idParsed.data.segmentId);
  await supabase.from("segment_rules").insert({ segment_id: idParsed.data.segmentId, conditions: parsed.conditions });

  await recordAudit({
    actorId: user.userId,
    action: "segment.updated",
    entityType: "segment",
    entityId: idParsed.data.segmentId,
    beforeData: before,
    afterData: { name: parsed.name, conditions: parsed.conditions },
  });

  revalidatePath("/segments");
  redirect("/segments");
}

export async function deleteSegmentAction(_prevState: SegmentActionState, formData: FormData): Promise<SegmentActionState> {
  const user = await requirePermission("segments.manage");

  const idParsed = segmentIdSchema.safeParse({ segmentId: formData.get("segmentId") });
  if (!idParsed.success) return { error: "Invalid segment" };

  const supabase = await createClient();

  const { data: segment } = await supabase.from("segments").select("is_system, name").eq("id", idParsed.data.segmentId).single();
  if (segment?.is_system) return { error: "System segments cannot be deleted" };

  const { error } = await supabase.from("segments").delete().eq("id", idParsed.data.segmentId);
  if (error) return { error: error.message };

  await recordAudit({
    actorId: user.userId,
    action: "segment.deleted",
    entityType: "segment",
    entityId: idParsed.data.segmentId,
    beforeData: segment,
  });

  revalidatePath("/segments");
  return { success: true };
}

