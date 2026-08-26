import "server-only";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/services/audit-service";
import type { CustomerRow, LoyaltyTierRow } from "@/lib/types/database";

export async function updateLoyaltyTier(actorId: string, tierId: string, minOrders: number, minSpend: number, benefits: string | null): Promise<LoyaltyTierRow> {
  const supabase = await createClient();
  const { data: before } = await supabase.from("loyalty_tiers").select("*").eq("id", tierId).single();

  const { data, error } = await supabase
    .from("loyalty_tiers")
    .update({ min_orders: minOrders, min_spend: minSpend, benefits })
    .eq("id", tierId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to update loyalty tier");

  await recordAudit({
    actorId,
    action: "loyalty_tier.updated",
    entityType: "loyalty_tier",
    entityId: tierId,
    beforeData: before ? { min_orders: before.min_orders, min_spend: before.min_spend } : null,
    afterData: { min_orders: minOrders, min_spend: minSpend },
  });

  return data;
}

export async function setReferrer(actorId: string, customerId: string, referredByCustomerId: string | null): Promise<CustomerRow> {
  const supabase = await createClient();

  if (referredByCustomerId === customerId) {
    throw new Error("A customer cannot refer themselves");
  }

  const { data, error } = await supabase.from("customers").update({ referred_by_customer_id: referredByCustomerId }).eq("id", customerId).select().single();
  if (error || !data) throw new Error(error?.message ?? "Failed to set referrer");

  await recordAudit({
    actorId,
    action: "customer.referrer_set",
    entityType: "customer",
    entityId: customerId,
    afterData: { referred_by_customer_id: referredByCustomerId },
  });

  return data;
}
