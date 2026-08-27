"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/services/audit-service";
import { recordCustomerEvent } from "@/lib/services/timeline-service";

export interface PromotionActionState {
  error?: string;
  success?: boolean;
}

const nullableUuid = z
  .string()
  .optional()
  .transform((v) => (v && v !== "any" ? v : null));

// ============ Offers ============

const offerFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  loyaltyTierId: nullableUuid,
  segmentId: nullableUuid,
  startsAt: z.string().min(1, "Start date is required"),
  endsAt: z.string().min(1, "End date is required"),
});

export async function createOfferAction(_prevState: PromotionActionState, formData: FormData): Promise<PromotionActionState> {
  const user = await requirePermission("promotions.manage");

  const parsed = offerFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    loyaltyTierId: formData.get("loyaltyTierId") ?? undefined,
    segmentId: formData.get("segmentId") ?? undefined,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  if (new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) return { error: "End date must be after the start date" };

  const supabase = await createClient();
  const { data: offer, error } = await supabase
    .from("offers")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      loyalty_tier_id: parsed.data.loyaltyTierId,
      segment_id: parsed.data.segmentId,
      starts_at: new Date(parsed.data.startsAt).toISOString(),
      ends_at: new Date(parsed.data.endsAt).toISOString(),
      created_by: user.userId,
    })
    .select("id")
    .single();
  if (error || !offer) return { error: error?.message ?? "Failed to create offer" };

  await recordAudit({ actorId: user.userId, action: "offer.created", entityType: "offer", entityId: offer.id, afterData: parsed.data });

  revalidatePath("/promotions");
  redirect("/promotions");
}

const idSchema = z.object({ id: z.string().uuid() });

export async function toggleOfferActiveAction(_prevState: PromotionActionState, formData: FormData): Promise<PromotionActionState> {
  await requirePermission("promotions.manage");
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid offer" };

  const supabase = await createClient();
  const { error } = await supabase.from("offers").update({ is_active: formData.get("isActive") === "true" }).eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/promotions");
  return { success: true };
}

export async function deleteOfferAction(_prevState: PromotionActionState, formData: FormData): Promise<PromotionActionState> {
  const user = await requirePermission("promotions.manage");
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid offer" };

  const supabase = await createClient();
  const { error } = await supabase.from("offers").delete().eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await recordAudit({ actorId: user.userId, action: "offer.deleted", entityType: "offer", entityId: parsed.data.id });

  revalidatePath("/promotions");
  return { success: true };
}

// ============ Coupons ============

const couponFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code is too short")
    .max(30)
    .regex(/^[A-Za-z0-9_-]+$/, "Code can only contain letters, numbers, - and _")
    .transform((v) => v.toUpperCase()),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.coerce.number().positive("Discount must be greater than 0"),
  loyaltyTierId: nullableUuid,
  segmentId: nullableUuid,
  usageLimit: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  expiresAt: z.string().optional().or(z.literal("")),
});

export async function createCouponAction(_prevState: PromotionActionState, formData: FormData): Promise<PromotionActionState> {
  const user = await requirePermission("promotions.manage");

  const parsed = couponFormSchema.safeParse({
    code: formData.get("code"),
    discountType: formData.get("discountType"),
    discountValue: formData.get("discountValue"),
    loyaltyTierId: formData.get("loyaltyTierId") ?? undefined,
    segmentId: formData.get("segmentId") ?? undefined,
    usageLimit: formData.get("usageLimit") ?? "",
    expiresAt: formData.get("expiresAt") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  if (parsed.data.discountType === "percentage" && parsed.data.discountValue > 100) return { error: "A percentage discount can't exceed 100" };

  const supabase = await createClient();
  const { data: coupon, error } = await supabase
    .from("coupons")
    .insert({
      code: parsed.data.code,
      discount_type: parsed.data.discountType,
      discount_value: parsed.data.discountValue,
      loyalty_tier_id: parsed.data.loyaltyTierId,
      segment_id: parsed.data.segmentId,
      usage_limit: parsed.data.usageLimit ?? null,
      expires_at: parsed.data.expiresAt ? new Date(parsed.data.expiresAt).toISOString() : null,
      created_by: user.userId,
    })
    .select("id")
    .single();
  if (error || !coupon) return { error: error?.message.includes("idx_coupons_code") ? "That code is already in use" : (error?.message ?? "Failed to create coupon") };

  await recordAudit({ actorId: user.userId, action: "coupon.created", entityType: "coupon", entityId: coupon.id, afterData: parsed.data });

  revalidatePath("/promotions");
  redirect("/promotions");
}

export async function toggleCouponActiveAction(_prevState: PromotionActionState, formData: FormData): Promise<PromotionActionState> {
  await requirePermission("promotions.manage");
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid coupon" };

  const supabase = await createClient();
  const { error } = await supabase.from("coupons").update({ is_active: formData.get("isActive") === "true" }).eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath("/promotions");
  return { success: true };
}

// Same "don't destroy real history" guard as campaigns — a coupon that's
// actually been redeemed must be deactivated, not deleted.
export async function deleteCouponAction(_prevState: PromotionActionState, formData: FormData): Promise<PromotionActionState> {
  const user = await requirePermission("promotions.manage");
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid coupon" };

  const supabase = await createClient();

  const { count } = await supabase.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", parsed.data.id);
  if (count && count > 0) return { error: "This coupon has redemption history — deactivate it instead of deleting." };

  const { error } = await supabase.from("coupons").delete().eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await recordAudit({ actorId: user.userId, action: "coupon.deleted", entityType: "coupon", entityId: parsed.data.id });

  revalidatePath("/promotions");
  return { success: true };
}

// ============ Redemptions ============

const redemptionFormSchema = z.object({
  couponId: z.string().uuid(),
  customerId: z.string().uuid(),
});

export async function logRedemptionAction(_prevState: PromotionActionState, formData: FormData): Promise<PromotionActionState> {
  const user = await requirePermission("promotions.redeem");

  const parsed = redemptionFormSchema.safeParse({ couponId: formData.get("couponId"), customerId: formData.get("customerId") });
  if (!parsed.success) return { error: "Invalid input" };

  const supabase = await createClient();

  const { data: coupon } = await supabase.from("coupons").select("*").eq("id", parsed.data.couponId).single();
  if (!coupon) return { error: "Coupon not found" };
  if (!coupon.is_active) return { error: "This coupon is not active" };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return { error: "This coupon has expired" };

  if (coupon.usage_limit !== null) {
    const { count } = await supabase.from("coupon_redemptions").select("id", { count: "exact", head: true }).eq("coupon_id", coupon.id);
    if ((count ?? 0) >= coupon.usage_limit) return { error: "This coupon has reached its usage limit" };
  }

  const { data: customer } = await supabase.from("customers").select("full_name").eq("id", parsed.data.customerId).single();

  const { error } = await supabase.from("coupon_redemptions").insert({
    coupon_id: coupon.id,
    customer_id: parsed.data.customerId,
    redeemed_by: user.userId,
  });
  if (error) return { error: error.message };

  await recordCustomerEvent({
    customerId: parsed.data.customerId,
    eventType: "coupon.redeemed",
    title: "Coupon redeemed",
    description: `${coupon.code} (${coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `EGP ${coupon.discount_value}`})`,
    relatedEmployeeId: user.userId,
  });

  await recordAudit({
    actorId: user.userId,
    action: "coupon.redeemed",
    entityType: "coupon",
    entityId: coupon.id,
    afterData: { customerId: parsed.data.customerId, customerName: customer?.full_name },
  });

  revalidatePath("/promotions");
  return { success: true };
}
