"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award } from "lucide-react";
import { setReferrerAction } from "@/app/(dashboard)/customers/[customerId]/actions";
import type { ActionState } from "@/app/(dashboard)/customers/actions";
import type { LoyaltyTierRow } from "@/lib/types/database";
import type { ReferralStats } from "@/lib/repositories/loyalty-repository";

const currency = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });
const initialState: ActionState = {};

interface CustomerLite {
  id: string;
  full_name: string;
}

export function LoyaltyReferralCard({
  customerId,
  tier,
  referralStats,
  canEditReferrer,
  customers,
}: {
  customerId: string;
  tier: LoyaltyTierRow | null;
  referralStats: ReferralStats;
  canEditReferrer: boolean;
  customers: CustomerLite[];
}) {
  const t = useTranslations("customerProfile.loyalty");
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(setReferrerAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("referrerUpdated"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Award className="size-4" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("tier")}</span>
          {tier ? <Badge variant="secondary">{tier.name}</Badge> : <span className="text-muted-foreground">—</span>}
        </div>
        {tier?.benefits ? <p className="text-xs text-muted-foreground">{tier.benefits}</p> : null}

        <div className="border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("referredBy")}</span>
            {!editing ? (
              <div className="flex items-center gap-2">
                <span>{referralStats.referredByName ?? "—"}</span>
                {canEditReferrer ? (
                  <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => setEditing(true)}>
                    {t("edit")}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          {editing ? (
            <form action={formAction} className="mt-2 flex items-center gap-2">
              <input type="hidden" name="customerId" value={customerId} />
              <Select name="referredByCustomerId">
                <SelectTrigger className="h-8 w-full">
                  <SelectValue placeholder={t("chooseCustomer")} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" disabled={isPending} className="h-8 shrink-0">
                {isPending ? t("saving") : t("save")}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-8 shrink-0" onClick={() => setEditing(false)}>
                {t("cancel")}
              </Button>
            </form>
          ) : null}
        </div>

        <div className="border-t pt-3">
          <p className="mb-1 text-xs text-muted-foreground">
            {t("referralsMade", { count: referralStats.referrals.length, revenue: currency.format(referralStats.totalReferralRevenue) })}
          </p>
          {referralStats.referrals.length > 0 ? (
            <ul className="space-y-1">
              {referralStats.referrals.map((r) => (
                <li key={r.id} className="flex justify-between text-xs text-muted-foreground">
                  <span>{r.fullName}</span>
                  <span className="tabular-nums">{currency.format(r.totalSpend)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
