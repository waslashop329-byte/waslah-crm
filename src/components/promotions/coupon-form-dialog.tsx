"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCouponAction, type PromotionActionState } from "@/app/(dashboard)/promotions/actions";
import type { LoyaltyTierRow } from "@/lib/types/database";

const initialState: PromotionActionState = {};

export function CouponFormDialog({ tiers, segments }: { tiers: LoyaltyTierRow[]; segments: { id: string; name: string }[] }) {
  const t = useTranslations("promotions.coupons");
  const [open, setOpen] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [state, formAction, isPending] = useActionState(createCouponAction, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="size-3.5" />
          {t("newCoupon")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="coupon-code">{t("code")}</Label>
            <Input id="coupon-code" name="code" placeholder="SUMMER10" required className="uppercase" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("discountType")}</Label>
              <Select name="discountType" value={discountType} onValueChange={(v) => setDiscountType(v as "percentage" | "fixed")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">{t("percentage")}</SelectItem>
                  <SelectItem value="fixed">{t("fixedAmount")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-value">{discountType === "percentage" ? t("discountValuePercent") : t("discountValueFixed")}</Label>
              <Input id="coupon-value" name="discountValue" type="number" min={0.01} step="0.01" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("targetTier")}</Label>
              <Select name="loyaltyTierId" defaultValue="any">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("anyTier")}</SelectItem>
                  {tiers.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      {tier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("targetSegment")}</Label>
              <Select name="segmentId" defaultValue="any">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("anySegment")}</SelectItem>
                  {segments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.id}>
                      {segment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="coupon-limit">{t("usageLimit")}</Label>
              <Input id="coupon-limit" name="usageLimit" type="number" min={1} step="1" placeholder={t("unlimited")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coupon-expires">{t("expiresAt")}</Label>
              <Input id="coupon-expires" name="expiresAt" type="date" />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("creating") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
