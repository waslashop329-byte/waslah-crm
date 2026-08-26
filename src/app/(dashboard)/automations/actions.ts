"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/services/audit-service";
import { validateSegmentConditions } from "@/lib/intelligence/segments/segment-schema";
import { automationActionsSchema } from "@/lib/intelligence/automation/action-schema";
import { automationTriggerSchema } from "@/lib/intelligence/automation/trigger-schema";

export interface AutomationActionState {
  error?: string;
  success?: boolean;
}

const ruleFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  trigger: automationTriggerSchema,
  conditionsJson: z.string().min(1),
  actionsJson: z.string().min(1),
});

async function parseRuleForm(formData: FormData) {
  const parsed = ruleFormSchema.safeParse({
    name: formData.get("name"),
    trigger: formData.get("trigger"),
    conditionsJson: formData.get("conditionsJson"),
    actionsJson: formData.get("actionsJson"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" } as const;

  let rawConditions: unknown;
  let rawActions: unknown;
  try {
    rawConditions = JSON.parse(parsed.data.conditionsJson);
    rawActions = JSON.parse(parsed.data.actionsJson);
  } catch {
    return { error: "Invalid rule format" } as const;
  }

  const conditionsResult = validateSegmentConditions(rawConditions);
  if (!conditionsResult.success) return { error: conditionsResult.error } as const;

  const actionsResult = automationActionsSchema.safeParse(rawActions);
  if (!actionsResult.success) return { error: actionsResult.error.issues[0]?.message ?? "Invalid actions" } as const;

  return {
    success: true,
    name: parsed.data.name,
    trigger: parsed.data.trigger,
    conditions: conditionsResult.data,
    actions: actionsResult.data,
  } as const;
}

export async function createAutomationRuleAction(_prevState: AutomationActionState, formData: FormData): Promise<AutomationActionState> {
  const user = await requirePermission("automations.manage");

  const parsed = await parseRuleForm(formData);
  if (!parsed.success) return { error: parsed.error };

  const supabase = await createClient();

  const { data: rule, error } = await supabase
    .from("automation_rules")
    .insert({
      name: parsed.name,
      trigger_event: parsed.trigger,
      conditions: parsed.conditions,
      actions: parsed.actions,
      is_active: true,
      created_by: user.userId,
    })
    .select("id")
    .single();

  if (error || !rule) return { error: error?.message ?? "Failed to create automation" };

  await recordAudit({
    actorId: user.userId,
    action: "automation_rule.created",
    entityType: "automation_rule",
    entityId: rule.id,
    afterData: { name: parsed.name, trigger: parsed.trigger },
  });

  revalidatePath("/automations");
  redirect("/automations");
}

const ruleIdSchema = z.object({ ruleId: z.string().uuid() });

export async function updateAutomationRuleAction(_prevState: AutomationActionState, formData: FormData): Promise<AutomationActionState> {
  const user = await requirePermission("automations.manage");

  const idParsed = ruleIdSchema.safeParse({ ruleId: formData.get("ruleId") });
  if (!idParsed.success) return { error: "Invalid automation" };

  const parsed = await parseRuleForm(formData);
  if (!parsed.success) return { error: parsed.error };

  const supabase = await createClient();

  const { data: before } = await supabase.from("automation_rules").select("name, trigger_event").eq("id", idParsed.data.ruleId).single();

  const { error } = await supabase
    .from("automation_rules")
    .update({ name: parsed.name, trigger_event: parsed.trigger, conditions: parsed.conditions, actions: parsed.actions })
    .eq("id", idParsed.data.ruleId);

  if (error) return { error: error.message };

  await recordAudit({
    actorId: user.userId,
    action: "automation_rule.updated",
    entityType: "automation_rule",
    entityId: idParsed.data.ruleId,
    beforeData: before,
    afterData: { name: parsed.name, trigger: parsed.trigger },
  });

  revalidatePath("/automations");
  redirect("/automations");
}

export async function toggleAutomationRuleAction(_prevState: AutomationActionState, formData: FormData): Promise<AutomationActionState> {
  const user = await requirePermission("automations.manage");

  const idParsed = ruleIdSchema.safeParse({ ruleId: formData.get("ruleId") });
  if (!idParsed.success) return { error: "Invalid automation" };
  const isActive = formData.get("isActive") === "true";

  const supabase = await createClient();
  const { error } = await supabase.from("automation_rules").update({ is_active: !isActive }).eq("id", idParsed.data.ruleId);
  if (error) return { error: error.message };

  await recordAudit({
    actorId: user.userId,
    action: isActive ? "automation_rule.disabled" : "automation_rule.enabled",
    entityType: "automation_rule",
    entityId: idParsed.data.ruleId,
  });

  revalidatePath("/automations");
  return { success: true };
}

export async function deleteAutomationRuleAction(_prevState: AutomationActionState, formData: FormData): Promise<AutomationActionState> {
  const user = await requirePermission("automations.manage");

  const idParsed = ruleIdSchema.safeParse({ ruleId: formData.get("ruleId") });
  if (!idParsed.success) return { error: "Invalid automation" };

  const supabase = await createClient();
  const { data: rule } = await supabase.from("automation_rules").select("name").eq("id", idParsed.data.ruleId).single();

  const { error } = await supabase.from("automation_rules").delete().eq("id", idParsed.data.ruleId);
  if (error) return { error: error.message };

  await recordAudit({
    actorId: user.userId,
    action: "automation_rule.deleted",
    entityType: "automation_rule",
    entityId: idParsed.data.ruleId,
    beforeData: rule,
  });

  revalidatePath("/automations");
  return { success: true };
}
