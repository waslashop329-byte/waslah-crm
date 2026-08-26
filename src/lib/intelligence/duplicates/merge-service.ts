import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { recalculateCustomerStats } from "@/lib/integrations/sync/customer-stats";
import { recordAudit } from "@/lib/services/audit-service";
import { dispatchEvent } from "@/lib/events/dispatcher";

export type MergeSummary = {
  orders_moved: number;
  phones_moved: number;
  addresses_moved: number;
  notes_moved: number;
  events_moved: number;
  follow_ups_moved: number;
  tags_moved: number;
  tags_soft_removed: number;
  external_ids_moved: number;
  score_history_moved: number;
}

// The atomic part (moving every related row) happens inside the
// merge_customers Postgres function — see migration 0043. Everything here
// is *derived* recomputation that's safe to run after the transaction
// commits, since stats/score/risk are always recalculated from current
// state (idempotent) rather than incremented.
export async function mergeCustomers(
  primaryId: string,
  secondaryId: string,
  actorId: string,
  candidateId?: string,
): Promise<MergeSummary> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("merge_customers", {
    p_primary_id: primaryId,
    p_secondary_id: secondaryId,
    p_actor_id: actorId,
  });

  if (error) {
    throw new Error(`Merge failed: ${error.message}`);
  }

  const summary = data as unknown as MergeSummary;

  // Stats must be recomputed before score/risk can see the moved orders, so
  // this one stays a direct call; score/risk themselves go through the
  // dispatcher like every other trigger, keeping this file unaware of who
  // (currently: score-risk-subscriber) actually reacts to a merge.
  await recalculateCustomerStats(primaryId);
  await dispatchEvent("customer.updated", { customerId: primaryId });
  await dispatchEvent("customer.merged", { primaryCustomerId: primaryId, secondaryCustomerId: secondaryId });

  if (candidateId) {
    await supabase
      .from("duplicate_candidates")
      .update({ status: "merged", resolved_at: new Date().toISOString(), resolved_by: actorId })
      .eq("id", candidateId);
  }

  await recordAudit({
    actorId,
    action: "customer.merged",
    entityType: "customer",
    entityId: primaryId,
    beforeData: { secondary_customer_id: secondaryId },
    afterData: summary,
  });

  return summary;
}
