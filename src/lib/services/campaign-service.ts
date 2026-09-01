import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCustomerMessage } from "@/lib/services/message-service";
import { renderMessageTemplate } from "@/lib/messaging/template";
import { computeNextSendAt, shouldExitEarly } from "@/lib/intelligence/campaigns/campaign-scheduler";
import { calculateWinbackStage } from "@/lib/intelligence/loyalty/winback-stages";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import type { CampaignStepRow } from "@/lib/types/database";

// Admin client throughout: enrollment is triggered from an event subscriber
// (order.delivered, no user session) and from the cron endpoint (bearer-secret
// auth, no Supabase session either) — same reasoning as message-service.ts.

/**
 * Enrolls one customer into one campaign, computing the first step's
 * send time from its delay. No-ops if the customer already has an active
 * enrollment in this campaign (the unique index is the real guarantee;
 * this check just avoids a needless insert attempt) or if the campaign has
 * no steps to run.
 */
export async function enrollCustomerInCampaign(campaignId: string, customerId: string, relatedOrderId: string | null = null): Promise<void> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("campaign_enrollments")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("customer_id", customerId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return;

  const { data: steps } = await supabase.from("campaign_steps").select("step_order, delay_days").eq("campaign_id", campaignId).order("step_order");
  if (!steps || steps.length === 0) return;

  const enrolledAt = new Date();
  const nextSendAt = computeNextSendAt(
    enrolledAt,
    steps.map((s) => ({ stepOrder: s.step_order, delayDays: s.delay_days })),
    0,
  );
  if (!nextSendAt) return;

  await supabase.from("campaign_enrollments").insert({
    campaign_id: campaignId,
    customer_id: customerId,
    related_order_id: relatedOrderId,
    current_step_index: 0,
    next_send_at: nextSendAt.toISOString(),
    status: "active",
    exit_reason: null,
    completed_at: null,
  });
}

/**
 * Enrolls every customer past a win-back threshold (30/60/90/120d, same
 * stages as the manual Phase 11 win-back page) into the given
 * customer_inactive campaign — called once per day by the maintenance cron,
 * not on every request. A customer is skipped if they already have any
 * enrollment (active or finished) in this campaign, so this is safe to call
 * repeatedly without re-enrolling the same lapsed customer every single day.
 */
export async function enrollEligibleInactiveCustomers(campaignId: string): Promise<{ enrolled: number }> {
  const supabase = createAdminClient();
  const now = new Date();

  // Pages past PostgREST's 1000-row cap — every customer with a last order
  // needs to be scanned regardless of how large the real customer base grows.
  const customers = await fetchAllRows((from, to) =>
    supabase.from("customers").select("id, last_order_at").is("deleted_at", null).not("last_order_at", "is", null).range(from, to),
  );

  let enrolled = 0;
  for (const customer of customers) {
    const daysSince = (now.getTime() - new Date(customer.last_order_at!).getTime()) / (1000 * 60 * 60 * 24);
    if (!calculateWinbackStage(daysSince)) continue;

    const { data: everEnrolled } = await supabase
      .from("campaign_enrollments")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("customer_id", customer.id)
      .maybeSingle();
    if (everEnrolled) continue;

    await enrollCustomerInCampaign(campaignId, customer.id);
    enrolled += 1;
  }

  return { enrolled };
}

export interface ProcessCampaignStepsResult {
  sent: number;
  completed: number;
  exited: number;
}

/**
 * Sends every step that's due (next_send_at <= now) across every active
 * enrollment, advances each to its next step or marks it completed, and
 * exits any enrollment whose customer already ordered again. Called by
 * /api/cron/maintenance — this is the function a real scheduler needs to
 * invoke periodically for campaigns to actually run.
 */
export async function processDueCampaignSteps(): Promise<ProcessCampaignStepsResult> {
  const supabase = createAdminClient();
  const now = new Date();

  const { data: due, error } = await supabase
    .from("campaign_enrollments")
    .select("*, customers(full_name, last_order_at)")
    .eq("status", "active")
    .lte("next_send_at", now.toISOString());
  if (error) throw new Error(error.message);

  let sent = 0;
  let completed = 0;
  let exited = 0;

  for (const enrollment of due ?? []) {
    const customer = enrollment.customers as unknown as { full_name: string; last_order_at: string | null } | null;

    if (shouldExitEarly(enrollment.enrolled_at, customer?.last_order_at ?? null)) {
      await supabase
        .from("campaign_enrollments")
        .update({ status: "exited", exit_reason: "customer_ordered_again", completed_at: now.toISOString() })
        .eq("id", enrollment.id);
      exited += 1;
      continue;
    }

    const { data: steps } = await supabase.from("campaign_steps").select("*").eq("campaign_id", enrollment.campaign_id).order("step_order");
    const sortedSteps = (steps ?? []) as CampaignStepRow[];
    const step = sortedSteps[enrollment.current_step_index];

    if (!step) {
      await supabase.from("campaign_enrollments").update({ status: "completed", completed_at: now.toISOString() }).eq("id", enrollment.id);
      completed += 1;
      continue;
    }

    const body = renderMessageTemplate(step.message_template, { customerName: customer?.full_name ?? "there" });
    await sendCustomerMessage(null, enrollment.customer_id, step.channel, body, enrollment.related_order_id);
    sent += 1;

    const nextIndex = enrollment.current_step_index + 1;
    const nextSendAt = computeNextSendAt(
      new Date(enrollment.enrolled_at),
      sortedSteps.map((s) => ({ stepOrder: s.step_order, delayDays: s.delay_days })),
      nextIndex,
    );

    if (nextSendAt) {
      await supabase.from("campaign_enrollments").update({ current_step_index: nextIndex, next_send_at: nextSendAt.toISOString() }).eq("id", enrollment.id);
    } else {
      await supabase.from("campaign_enrollments").update({ current_step_index: nextIndex, status: "completed", completed_at: now.toISOString() }).eq("id", enrollment.id);
      completed += 1;
    }
  }

  return { sent, completed, exited };
}
