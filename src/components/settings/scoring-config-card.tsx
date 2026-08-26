"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { updateScoringRuleAction, updateThresholdAction, type SettingsActionState } from "@/app/(dashboard)/settings/actions";
import type { ScoringRuleRow, ScoreCategoryThresholdRow } from "@/lib/types/database";

const initialState: SettingsActionState = {};

export function ScoringConfigCard({ rules, thresholds }: { rules: ScoringRuleRow[]; thresholds: ScoreCategoryThresholdRow[] }) {
  const t = useTranslations("settings.scoring");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("rulesTitle")}</CardTitle>
          <CardDescription>{t("rulesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("rule")}</TableHead>
                <TableHead className="w-24">{t("weight")}</TableHead>
                <TableHead className="w-28">{t("threshold")}</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <ScoringRuleRowForm key={rule.id} rule={rule} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("categoriesTitle")}</CardTitle>
          <CardDescription>{t("categoriesDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("category")}</TableHead>
                <TableHead className="w-24">{t("minScore")}</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {thresholds.map((threshold) => (
                <ThresholdRowForm key={threshold.id} threshold={threshold} />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ScoringRuleRowForm({ rule }: { rule: ScoringRuleRow }) {
  const t = useTranslations("settings.scoring");
  const [state, formAction, isPending] = useActionState(updateScoringRuleAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("ruleUpdated", { label: rule.label }));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <TableRow>
      <TableCell className="text-sm">
        <Label htmlFor={`weight-${rule.id}`} className="font-normal">
          {rule.label}
        </Label>
      </TableCell>
      <TableCell colSpan={3} className="p-0">
        <form action={formAction} className="flex items-center gap-2 px-3 py-1.5">
          <input type="hidden" name="ruleId" value={rule.id} />
          <input type="hidden" name="isActive" value={String(rule.is_active)} />
          <Input id={`weight-${rule.id}`} name="weight" type="number" step="0.1" defaultValue={rule.weight} className="h-8 w-20" />
          <Input
            name="threshold"
            type="number"
            step="0.01"
            defaultValue={rule.threshold ?? ""}
            placeholder="—"
            className="h-8 w-24"
          />
          <Button type="submit" size="sm" variant="outline" disabled={isPending} className="h-8">
            {isPending ? t("saving") : t("save")}
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}

function ThresholdRowForm({ threshold }: { threshold: ScoreCategoryThresholdRow }) {
  const t = useTranslations("settings.scoring");
  const [state, formAction, isPending] = useActionState(updateThresholdAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("thresholdUpdated", { label: threshold.label }));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <TableRow>
      <TableCell className="text-sm">{threshold.label}</TableCell>
      <TableCell colSpan={2} className="p-0">
        <form action={formAction} className="flex items-center gap-2 px-3 py-1.5">
          <input type="hidden" name="thresholdId" value={threshold.id} />
          <Input name="minScore" type="number" min={0} max={100} defaultValue={threshold.min_score} className="h-8 w-20" />
          <Button type="submit" size="sm" variant="outline" disabled={isPending} className="h-8">
            {isPending ? t("saving") : t("save")}
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}
