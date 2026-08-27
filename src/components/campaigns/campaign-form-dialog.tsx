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
import { CampaignStepsBuilder } from "@/components/campaigns/campaign-steps-builder";
import { createCampaignAction, type CampaignActionState } from "@/app/(dashboard)/campaigns/actions";

const initialState: CampaignActionState = {};

export function CampaignFormDialog() {
  const t = useTranslations("campaigns");
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createCampaignAction, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" />
          {t("newCampaign")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">{t("name")}</Label>
            <Input id="campaign-name" name="name" required />
          </div>

          <div className="space-y-1.5">
            <Label>{t("triggerType")}</Label>
            <Select name="triggerType" defaultValue="order_delivered">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order_delivered">{t("triggerOrderDelivered")}</SelectItem>
                <SelectItem value="customer_inactive">{t("triggerCustomerInactive")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("triggerHelp")}</p>
          </div>

          <div className="space-y-1.5">
            <Label>{t("steps.title")}</Label>
            <CampaignStepsBuilder name="stepsJson" />
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
