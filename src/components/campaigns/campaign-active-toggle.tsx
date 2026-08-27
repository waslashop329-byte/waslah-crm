"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { toggleCampaignActiveAction } from "@/app/(dashboard)/campaigns/actions";

export function CampaignActiveToggle({ campaignId, initialActive }: { campaignId: string; initialActive: boolean }) {
  const t = useTranslations("campaigns");
  const [active, setActive] = useState(initialActive);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: boolean) {
    setActive(next);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("campaignId", campaignId);
      formData.set("isActive", String(next));
      const result = await toggleCampaignActiveAction({}, formData);
      if (result.error) {
        setActive(!next);
        toast.error(result.error);
      } else {
        toast.success(next ? t("activated") : t("deactivated"));
      }
    });
  }

  return <Switch checked={active} onCheckedChange={handleChange} disabled={isPending} aria-label={t("toggleActive")} />;
}
