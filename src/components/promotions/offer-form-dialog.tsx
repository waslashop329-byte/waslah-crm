"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createOfferAction, type PromotionActionState } from "@/app/(dashboard)/promotions/actions";
import type { LoyaltyTierRow } from "@/lib/types/database";

const initialState: PromotionActionState = {};

export function OfferFormDialog({ tiers, segments }: { tiers: LoyaltyTierRow[]; segments: { id: string; name: string }[] }) {
  const t = useTranslations("promotions.offers");
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createOfferAction, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="size-3.5" />
          {t("newOffer")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="offer-name">{t("name")}</Label>
            <Input id="offer-name" name="name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="offer-description">{t("description")}</Label>
            <Textarea id="offer-description" name="description" rows={2} />
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
              <Label htmlFor="offer-starts">{t("startsAt")}</Label>
              <Input id="offer-starts" name="startsAt" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-ends">{t("endsAt")}</Label>
              <Input id="offer-ends" name="endsAt" type="date" required />
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
