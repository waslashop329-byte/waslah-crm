import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateCustomerScore } from "@/lib/intelligence/scoring/scoring-service";
import { scanForDuplicateCandidates } from "@/lib/intelligence/duplicates/duplicate-detection-service";

// Scheduled-maintenance entrypoint, same pattern as /api/sync (Part 10):
// bearer-secret auth, no Supabase session, provider-independent — call it
// from Vercel Cron, n8n, GitHub Actions, or a plain curl-based scheduler.
//
// Deliberately narrow scope: only recomputes things that can go *silently
// stale purely from the passage of time* with no new CRM event to trigger a
// recalculation (a score's "active in the last 30 days" rule decays even
// though nothing happened), plus a duplicate-candidate scan so new pairs
// don't wait for someone to remember to click "Scan for duplicates". It does
// NOT auto-send win-back messages — that stays an explicit, human-reviewed
// action even though the messaging provider is still mock-only today, since
// silently wiring auto-send into a timer is a product decision, not
// something to fold into a maintenance job.
export async function POST(request: NextRequest) {
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

  return NextResponse.json({
    customersProcessed: customers?.length ?? 0,
    scoresRecalculated,
    scoresChanged,
    scoreErrors,
    duplicateScan,
  });
}
