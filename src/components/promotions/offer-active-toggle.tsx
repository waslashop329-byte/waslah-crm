"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";
import { toggleOfferActiveAction } from "@/app/(dashboard)/promotions/actions";

export function OfferActiveToggle({ offerId, initialActive }: { offerId: string; initialActive: boolean }) {
  const t = useTranslations("promotions");
  const [active, setActive] = useState(initialActive);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: boolean) {
    setActive(next);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", offerId);
      formData.set("isActive", String(next));
      const result = await toggleOfferActiveAction({}, formData);
      if (result.error) {
        setActive(!next);
        toast.error(result.error);
      }
    });
  }

  return <Switch checked={active} onCheckedChange={handleChange} disabled={isPending} aria-label={t("toggleActive")} />;
}
