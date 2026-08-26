"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setAcquisitionAction } from "@/app/(dashboard)/customers/[customerId]/actions";
import type { ActionState } from "@/app/(dashboard)/customers/actions";
import type { CustomerProfitability } from "@/lib/intelligence/economics/customer-profitability";
import type { CustomerAcquisitionRow } from "@/lib/types/database";

const currency = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });
const initialState: ActionState = {};

export function ProfitabilityCard({
  customerId,
  profitability,
  acquisition,
}: {
  customerId: string;
  profitability: CustomerProfitability;
  acquisition: CustomerAcquisitionRow | null;
}) {
  const t = useTranslations("customerProfile.profitability");
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(setAcquisitionAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("saved"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("realizedLtv")}</p>
            <p className="text-lg font-semibold tabular-nums">{currency.format(profitability.realizedLtv)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("netProfit")}</p>
            <p className="text-lg font-semibold tabular-nums">{currency.format(profitability.netProfit)}</p>
            {profitability.ordersMissingCostData > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("ordersMissingCostData", { missing: profitability.ordersMissingCostData, total: profitability.totalOrders })}
              </p>
            ) : null}
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("acquisition")}</p>
          {editing ? (
            <form action={formAction} className="space-y-2">
              <input type="hidden" name="customerId" value={customerId} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="acq-source" className="mb-1 block text-xs text-muted-foreground">
                    {t("source")}
                  </Label>
                  <Input id="acq-source" name="source" defaultValue={acquisition?.source ?? ""} placeholder={t("sourcePlaceholder")} className="h-8" />
                </div>
                <div>
                  <Label htmlFor="acq-medium" className="mb-1 block text-xs text-muted-foreground">
                    {t("medium")}
                  </Label>
                  <Input id="acq-medium" name="medium" defaultValue={acquisition?.medium ?? ""} placeholder={t("mediumPlaceholder")} className="h-8" />
                </div>
              </div>
              <div>
                <Label htmlFor="acq-campaign" className="mb-1 block text-xs text-muted-foreground">
                  {t("campaign")}
                </Label>
                <Input id="acq-campaign" name="campaign" defaultValue={acquisition?.campaign ?? ""} className="h-8" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending} className="h-8">
                  {isPending ? t("saving") : t("save")}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>
                  {t("cancel")}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">
                {acquisition?.source ? (
                  <>
                    {acquisition.source}
                    {acquisition.medium ? ` · ${acquisition.medium}` : ""}
                    {acquisition.campaign ? ` · ${acquisition.campaign}` : ""}
                  </>
                ) : (
                  t("notTagged")
                )}
              </p>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>
                {t("edit")}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
