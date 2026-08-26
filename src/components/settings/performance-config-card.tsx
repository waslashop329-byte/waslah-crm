"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updatePerformanceConfigAction, type SettingsActionState } from "@/app/(dashboard)/settings/actions";
import type { PerformanceConfigRow } from "@/lib/types/database";

const initialState: SettingsActionState = {};

export function PerformanceConfigCard({ config }: { config: PerformanceConfigRow }) {
  const t = useTranslations("settings.performance");
  const [state, formAction, isPending] = useActionState(updatePerformanceConfigAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("configUpdated"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="configId" value={config.id} />
          <div>
            <Label htmlFor="commission-rate" className="mb-1 block text-xs text-muted-foreground">
              {t("commissionRate")}
            </Label>
            <Input id="commission-rate" name="commissionRatePercent" type="number" min={0} max={100} step="0.1" defaultValue={config.commission_rate_percent} className="h-9 w-28" />
          </div>
          <div>
            <Label htmlFor="xp-confirmed" className="mb-1 block text-xs text-muted-foreground">
              {t("xpConfirmed")}
            </Label>
            <Input id="xp-confirmed" name="xpPerConfirmedOrder" type="number" min={0} defaultValue={config.xp_per_confirmed_order} className="h-9 w-28" />
          </div>
          <div>
            <Label htmlFor="xp-followup" className="mb-1 block text-xs text-muted-foreground">
              {t("xpFollowup")}
            </Label>
            <Input id="xp-followup" name="xpPerCompletedFollowup" type="number" min={0} defaultValue={config.xp_per_completed_followup} className="h-9 w-28" />
          </div>
          <Button type="submit" disabled={isPending} className="h-9">
            {isPending ? t("saving") : t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
