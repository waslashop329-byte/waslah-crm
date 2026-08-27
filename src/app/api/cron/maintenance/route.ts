import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateCustomerScore } from "@/lib/intelligence/scoring/scoring-service";
import { scanForDuplicateCandidates } from "@/lib/intelligence/duplicates/duplicate-detection-service";
import { enrollEligibleInactiveCustomers, processDueCampaignSteps } from "@/lib/services/campaign-service";

// Scheduled-maintenance entrypoint, same pattern as /api/sync (Part 10):
// bearer-secret auth, no Supabase session, provider-independent — call it
// from Vercel Cron, n8n, GitHub Actions, or a plain curl-based scheduler.
//
// Both GET and POST run the identical job. GET exists specifically because
// Vercel Cron only ever sends GET requests; POST is kept for manual/curl/n8n
// triggering, matching how this was originally tested. Vercel automatically
// attaches `Authorization: Bearer <CRON_SECRET>` to its cron requests when a
// CRON_SECRET env var is set — set it to the same value as CRON_API_SECRET
// below and no extra code is needed to recognize Vercel's own calls.
//
// Recomputes things that can go *silently stale purely from the passage of
// time* with no new CRM event to trigger a recalculation (a score's "active
// in the last 30 days" rule decays even though nothing happened), plus a
// duplicate-candidate scan so new pairs don't wait for someone to remember to
// click "Scan for duplicates".
//
// Phase 16 addition: also enrolls win-back-eligible customers into any active
// customer_inactive campaign and sends whatever campaign steps are due. This
// is NOT the same thing as the old "silently auto-send win-back on a timer"
// concern noted here previously — a campaign only exists and only sends
// anything because an admin/marketing user explicitly created it and flipped
// it active in the /campaigns UI; this job just executes what they configured,
// the same way it already executes score recalculation rules someone configured.
export async function GET(request: NextRequest) {
  return runMaintenance(request);
}

export async function POST(request: NextRequest) {
  return runMaintenance(request);
}

async function runMaintenance(request: NextRequest) {
  const expectedSecret = process.env.CRON_API_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "CRON_API_SECRET is not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: customers, error } = await supabase.from("customers").select("id").is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let scoresRecalculated = 0;
  let scoresChanged = 0;
  let scoreErrors = 0;

  for (const customer of customers ?? []) {
    try {
      const result = await recalculateCustomerScore(customer.id, "scheduled.daily_maintenance");
      scoresRecalculated++;
      if (result.changed) scoresChanged++;
    } catch {
      scoreErrors++;
    }
  }

  let duplicateScan: { pairsEvaluated: number; candidatesRecorded: number } | { failed: string };
  try {
    duplicateScan = await scanForDuplicateCandidates();
  } catch (scanError) {
    duplicateScan = { failed: scanError instanceof Error ? scanError.message : "Unknown error" };
  }

  let campaignEnrollment: { campaignsScanned: number; customersEnrolled: number } | { failed: string };
  let campaignSteps: { sent: number; completed: number; exited: number } | { failed: string };
  try {
    const { data: inactiveCampaigns } = await supabase.from("campaigns").select("id").eq("trigger_type", "customer_inactive").eq("is_active", true);
    let customersEnrolled = 0;
    for (const campaign of inactiveCampaigns ?? []) {
      const result = await enrollEligibleInactiveCustomers(campaign.id);
      customersEnrolled += result.enrolled;
    }
    campaignEnrollment = { campaignsScanned: inactiveCampaigns?.length ?? 0, customersEnrolled };
  } catch (enrollError) {
    campaignEnrollment = { failed: enrollError instanceof Error ? enrollError.message : "Unknown error" };
  }

  try {
    campaignSteps = await processDueCampaignSteps();
  } catch (stepsError) {
    campaignSteps = { failed: stepsError instanceof Error ? stepsError.message : "Unknown error" };
  }

  return NextResponse.json({
    customersProcessed: customers?.length ?? 0,
    scoresRecalculated,
    scoresChanged,
    scoreErrors,
    duplicateScan,
    campaignEnrollment,
    campaignSteps,
  });
}
