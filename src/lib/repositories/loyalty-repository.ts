import "server-only";
import { createClient } from "@/lib/supabase/server";
import { calculateLoyaltyTier } from "@/lib/intelligence/loyalty/loyalty-tier";
import type { LoyaltyTierRow } from "@/lib/types/database";

export async function getLoyaltyTiers(): Promise<LoyaltyTierRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("loyalty_tiers").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCustomerLoyaltyTier(customerId: string): Promise<LoyaltyTierRow | null> {
  const supabase = await createClient();

  const [{ data: customer }, tiers] = await Promise.all([
    supabase.from("customers").select("total_orders, total_spend").eq("id", customerId).single(),
    getLoyaltyTiers(),
  ]);

  if (!customer) return null;

  const tier = calculateLoyaltyTier(
    { totalOrders: customer.total_orders, totalSpend: customer.total_spend },
    tiers.map((t) => ({ name: t.name, minOrders: t.min_orders, minSpend: t.min_spend, sortOrder: t.sort_order })),
  );

  return tiers.find((t) => t.name === tier?.name) ?? null;
}

export interface ReferralStats {
  referredByName: string | null;
  referrals: { id: string; fullName: string; totalSpend: number }[];
  totalReferralRevenue: number;
}

export async function getReferralStats(customerId: string): Promise<ReferralStats> {
  const supabase = await createClient();

  const [{ data: customer }, { data: referrals }] = await Promise.all([
    supabase.from("customers").select("referred_by_customer_id").eq("id", customerId).single(),
    supabase.from("customers").select("id, full_name, total_spend").eq("referred_by_customer_id", customerId).is("deleted_at", null),
  ]);

  let referredByName: string | null = null;
  if (customer?.referred_by_customer_id) {
    const { data: referrer } = await supabase.from("customers").select("full_name").eq("id", customer.referred_by_customer_id).maybeSingle();
    referredByName = referrer?.full_name ?? null;
  }

  const list = (referrals ?? []).map((r) => ({ id: r.id, fullName: r.full_name, totalSpend: r.total_spend }));

  return {
    referredByName,
    referrals: list,
    totalReferralRevenue: list.reduce((sum, r) => sum + r.totalSpend, 0),
  };
}
