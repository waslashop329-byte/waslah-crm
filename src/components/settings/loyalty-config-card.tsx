"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { updateLoyaltyTierAction, type SettingsActionState } from "@/app/(dashboard)/settings/actions";
import type { LoyaltyTierRow } from "@/lib/types/database";

const initialState: SettingsActionState = {};

export function LoyaltyConfigCard({ tiers }: { tiers: LoyaltyTierRow[] }) {
  const t = useTranslations("settings.loyalty");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("tier")}</TableHead>
              <TableHead className="w-24">{t("minOrders")}</TableHead>
              <TableHead className="w-28">{t("minSpend")}</TableHead>
              <TableHead>{t("benefits")}</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.map((tier) => (
              <TierRowForm key={tier.id} tier={tier} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TierRowForm({ tier }: { tier: LoyaltyTierRow }) {
  const t = useTranslations("settings.loyalty");
  const [state, formAction, isPending] = useActionState(updateLoyaltyTierAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("tierUpdated", { name: tier.name }));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <TableRow>
      <TableCell className="text-sm">
        <Label htmlFor={`orders-${tier.id}`} className="font-normal">
          {tier.name}
        </Label>
      </TableCell>
      <TableCell colSpan={4} className="p-0">
        <form action={formAction} className="flex items-center gap-2 px-3 py-1.5">
          <input type="hidden" name="tierId" value={tier.id} />
          <Input id={`orders-${tier.id}`} name="minOrders" type="number" min={0} step="1" defaultValue={tier.min_orders} className="h-8 w-20" />
          <Input name="minSpend" type="number" min={0} step="0.01" defaultValue={tier.min_spend} className="h-8 w-24" />
          <Input name="benefits" defaultValue={tier.benefits ?? ""} className="h-8 flex-1" />
          <Button type="submit" size="sm" variant="outline" disabled={isPending} className="h-8">
            {isPending ? t("saving") : t("save")}
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}
