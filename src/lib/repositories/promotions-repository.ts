import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { OfferRow, CouponRow } from "@/lib/types/database";

export interface OfferWithTargets extends OfferRow {
  loyaltyTierName: string | null;
  segmentName: string | null;
}

export async function listOffers(): Promise<OfferWithTargets[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("offers")
    .select("*, loyalty_tiers(name), segments(name)")
    .order("starts_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const { loyalty_tiers, segments, ...offer } = row as OfferRow & {
      loyalty_tiers: { name: string } | null;
      segments: { name: string } | null;
    };
    return { ...offer, loyaltyTierName: loyalty_tiers?.name ?? null, segmentName: segments?.name ?? null };
  });
}

export interface CouponWithTargets extends CouponRow {
  loyaltyTierName: string | null;
  segmentName: string | null;
  redemptionCount: number;
}

export async function listCoupons(): Promise<CouponWithTargets[]> {
  const supabase = await createClient();
  const { data: coupons, error } = await supabase
    .from("coupons")
    .select("*, loyalty_tiers(name), segments(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!coupons || coupons.length === 0) return [];

  const { data: redemptions } = await supabase
    .from("coupon_redemptions")
    .select("coupon_id")
    .in(
      "coupon_id",
      coupons.map((c) => c.id),
    );

  const countByCoupon = new Map<string, number>();
  for (const r of redemptions ?? []) {
    countByCoupon.set(r.coupon_id, (countByCoupon.get(r.coupon_id) ?? 0) + 1);
  }

  return coupons.map((row) => {
    const { loyalty_tiers, segments, ...coupon } = row as CouponRow & {
      loyalty_tiers: { name: string } | null;
      segments: { name: string } | null;
    };
    return {
      ...coupon,
      loyaltyTierName: loyalty_tiers?.name ?? null,
      segmentName: segments?.name ?? null,
      redemptionCount: countByCoupon.get(coupon.id) ?? 0,
    };
  });
}
