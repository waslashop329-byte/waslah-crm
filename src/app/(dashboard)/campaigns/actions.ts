"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/services/audit-service";

export interface CampaignActionState {
  error?: string;
  success?: boolean;
}

const stepSchema = z.object({
  delayDays: z.number().int().min(0).max(365),
  channel: z.enum(["whatsapp", "sms"]),
  messageTemplate: z.string().trim().min(1, "Message can't be empty").max(1000),
});

const campaignFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  triggerType: z.enum(["order_delivered", "customer_inactive"]),
  stepsJson: z.string().min(1),
});

// Steps are only ever set at creation time, not edited afterward — an
// enrollment's current_step_index points into this exact list, so changing
// step count/order for a campaign with existing enrollments could silently
// point an in-flight customer at the wrong message. Deactivate and create a
// new campaign instead of editing one that's already run.
export async function createCampaignAction(_prevState: CampaignActionState, formData: FormData): Promise<CampaignActionState> {
  const user = await requirePermission("campaigns.manage");

  const parsed = campaignFormSchema.safeParse({
    name: formData.get("name"),
    triggerType: formData.get("triggerType"),
    stepsJson: formData.get("stepsJson"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  let rawSteps: unknown;
  try {
    rawSteps = JSON.parse(parsed.data.stepsJson);
  } catch {
    return { error: "Invalid step format" };
  }

  const stepsParsed = z.array(stepSchema).min(1, "At least one step is required").max(10, "Too many steps").safeParse(rawSteps);
  if (!stepsParsed.success) return { error: stepsParsed.error.issues[0]?.message ?? "Invalid steps" };

  const supabase = await createClient();

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({ name: parsed.data.name, trigger_type: parsed.data.triggerType, is_active: false, created_by: user.userId })
    .select("id")
    .single();
  if (error || !campaign) return { error: error?.message ?? "Failed to create campaign" };

  const { error: stepsError } = await supabase.from("campaign_steps").insert(
    stepsParsed.data.map((step, index) => ({
      campaign_id: campaign.id,
      step_order: index,
      delay_days: step.delayDays,
      channel: step.channel,
      message_template: step.messageTemplate,
    })),
  );
  if (stepsError) return { error: stepsError.message };

  await recordAudit({
    actorId: user.userId,
    action: "campaign.created",
    entityType: "campaign",
    entityId: campaign.id,
    afterData: { name: parsed.data.name, triggerType: parsed.data.triggerType, stepCount: stepsParsed.data.length },
  });

  revalidatePath("/campaigns");
  redirect("/campaigns");
}

const campaignIdSchema = z.object({ campaignId: z.string().uuid() });

export async function toggleCampaignActiveAction(_prevState: CampaignActionState, formData: FormData): Promise<CampaignActionState> {
  const user = await requirePermission("campaigns.manage");

  const idParsed = campaignIdSchema.safeParse({ campaignId: formData.get("campaignId") });
  if (!idParsed.success) return { error: "Invalid campaign" };

  const nextActive = formData.get("isActive") === "true";

  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").update({ is_active: nextActive }).eq("id", idParsed.data.campaignId);
  if (error) return { error: error.message };

  await recordAudit({
    actorId: user.userId,
    action: nextActive ? "campaign.activated" : "campaign.deactivated",
    entityType: "campaign",
    entityId: idParsed.data.campaignId,
  });

  revalidatePath("/campaigns");
  return { success: true };
}

// Deleting is only allowed when the campaign has never enrolled anyone —
// same "don't destroy real history" principle used everywhere else in this
// codebase. A campaign that's actually run must be deactivated, not deleted.
export async function deleteCampaignAction(_prevState: CampaignActionState, formData: FormData): Promise<CampaignActionState> {
  const user = await requirePermission("campaigns.manage");

  const idParsed = campaignIdSchema.safeParse({ campaignId: formData.get("campaignId") });
  if (!idParsed.success) return { error: "Invalid campaign" };

  const supabase = await createClient();

  const { count } = await supabase
    .from("campaign_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", idParsed.data.campaignId);
  if (count && count > 0) return { error: "This campaign has enrollment history — deactivate it instead of deleting." };

  const { data: campaign } = await supabase.from("campaigns").select("name").eq("id", idParsed.data.campaignId).single();

  const { error } = await supabase.from("campaigns").delete().eq("id", idParsed.data.campaignId);
  if (error) return { error: error.message };

  await recordAudit({
    actorId: user.userId,
    action: "campaign.deleted",
    entityType: "campaign",
    entityId: idParsed.data.campaignId,
    beforeData: campaign,
  });

  revalidatePath("/campaigns");
  return { success: true };
}
