import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateConditions } from "@/lib/intelligence/automation/condition-evaluator";
import { executeAction } from "@/lib/intelligence/automation/action-handlers";
import { automationActionsSchema } from "@/lib/intelligence/automation/action-schema";
import { getCurrentAutomationDepth, runAtNextAutomationDepth, MAX_AUTOMATION_DEPTH } from "@/lib/intelligence/automation/execution-context";
import { createNotification } from "@/lib/services/notification-service";
import type { SegmentConditions } from "@/lib/intelligence/segments/segment-schema";
import type { AutomationRuleRow, SegmentCustomerViewRow } from "@/lib/types/database";

// Entry point the automation subscriber calls for every trigger event. One
// rule's action can itself dispatch a new event (e.g. create_follow_up ->
// follow_up.created) that re-enters here — getCurrentAutomationDepth() is
// how that nested call knows it's not the root call anymore.
export async function runAutomationsForEvent(triggerEvent: string, customerId: string): Promise<void> {
  if (getCurrentAutomationDepth() >= MAX_AUTOMATION_DEPTH) {
    console.warn(`Automation depth limit (${MAX_AUTOMATION_DEPTH}) reached for "${triggerEvent}" on customer ${customerId} — stopping a likely rule-triggers-rule loop.`);
    return;
  }

  const supabase = createAdminClient();

  const { data: rules } = await supabase.from("automation_rules").select("*").eq("trigger_event", triggerEvent).eq("is_active", true);
  if (!rules || rules.length === 0) return;

  const { data: customerRow } = await supabase.from("segment_customer_view").select("*").eq("id", customerId).maybeSingle();
  if (!customerRow) return;

  for (const rule of rules) {
    await runSingleRule(rule, customerRow as SegmentCustomerViewRow, triggerEvent, customerId);
  }
}

async function runSingleRule(
  rule: AutomationRuleRow,
  customerRow: SegmentCustomerViewRow,
  triggerEvent: string,
  customerId: string,
): Promise<void> {
  const supabase = createAdminClient();

  // Time-bucketed idempotency key (Part 13): unique per rule+trigger+customer
  // per 60-second window, backed by the DB's own unique index — a genuine
  // double-dispatch of the same underlying change collides and is skipped,
  // while the rule is still free to fire again for a real future occurrence.
  const timeBucket = Math.floor(Date.now() / 60_000);
  const idempotencyKey = `${rule.id}:${triggerEvent}:${customerId}:${timeBucket}`;

  const { data: execution, error: insertError } = await supabase
    .from("automation_executions")
    .insert({
      automation_rule_id: rule.id,
      customer_id: customerId,
      trigger_event: triggerEvent,
      status: "pending",
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (insertError || !execution) {
    if (insertError && insertError.code !== "23505") {
      console.error(`Failed to record automation execution for rule ${rule.id}`, insertError);
    }
    return; // 23505 = duplicate within this window, already handled — skip silently
  }

  const conditionsMatch = evaluateConditions(rule.conditions as unknown as SegmentConditions | null, customerRow);
  if (!conditionsMatch) {
    await supabase.from("automation_executions").update({ status: "skipped", completed_at: new Date().toISOString() }).eq("id", execution.id);
    return;
  }

  await supabase.from("automation_executions").update({ status: "running" }).eq("id", execution.id);

  const actionsResult = automationActionsSchema.safeParse(rule.actions);
  if (!actionsResult.success) {
    await finishAsFailed(execution.id, rule, customerId, `Invalid action configuration: ${actionsResult.error.issues.map((i) => i.message).join("; ")}`);
    return;
  }

  try {
    for (const action of actionsResult.data) {
      await runAtNextAutomationDepth(() => executeAction(action, { customerId, automationRuleId: rule.id }));
    }

    await supabase
      .from("automation_executions")
      .update({ status: "completed", completed_at: new Date().toISOString(), result: { actionsExecuted: actionsResult.data.length } })
      .eq("id", execution.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await finishAsFailed(execution.id, rule, customerId, message);
  }
}

async function finishAsFailed(executionId: string, rule: AutomationRuleRow, customerId: string, errorMessage: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from("automation_executions")
    .update({ status: "failed", completed_at: new Date().toISOString(), error: errorMessage })
    .eq("id", executionId);

  if (rule.created_by) {
    await createNotification({
      recipientId: rule.created_by,
      type: "automation_failed",
      title: `Automation "${rule.name}" failed`,
      message: errorMessage,
      relatedEntityType: "customer",
      relatedEntityId: customerId,
    });
  }
}
