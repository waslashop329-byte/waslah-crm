"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { createExperimentAction, recordExperimentResultAction, type AnalyticsActionState } from "@/app/(dashboard)/analytics/actions";
import type { ExperimentRow } from "@/lib/types/database";

const initialState: AnalyticsActionState = {};

const CATEGORY_KEYS: Record<string, string> = {
  product_page: "categoryProductPage",
  creative: "categoryCreative",
  offer: "categoryOffer",
  confirmation_script: "categoryConfirmationScript",
  upsell: "categoryUpsell",
};

export function ExperimentsPanel({ experiments, canManage }: { experiments: ExperimentRow[]; canManage: boolean }) {
  const t = useTranslations("analytics.experiments");

  return (
    <div className="flex flex-col gap-4">
      {canManage ? <NewExperimentCard /> : null}

      {experiments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noExperiments")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {experiments.map((experiment) => (
            <ExperimentCard key={experiment.id} experiment={experiment} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewExperimentCard() {
  const t = useTranslations("analytics.experiments");
  const [state, formAction, isPending] = useActionState(createExperimentAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("created"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("newExperiment")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="exp-name" className="mb-1 block text-xs text-muted-foreground">
              {t("name")}
            </Label>
            <Input id="exp-name" name="name" required className="h-9" />
          </div>
          <div>
            <Label htmlFor="exp-category" className="mb-1 block text-xs text-muted-foreground">
              {t("category")}
            </Label>
            <Select name="category" defaultValue="confirmation_script">
              <SelectTrigger id="exp-category" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_KEYS).map(([value, key]) => (
                  <SelectItem key={value} value={value}>
                    {t(key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="exp-a" className="mb-1 block text-xs text-muted-foreground">
              {t("variantAName")}
            </Label>
            <Input id="exp-a" name="variantAName" placeholder={t("variantAPlaceholder")} required className="h-9" />
          </div>
          <div>
            <Label htmlFor="exp-b" className="mb-1 block text-xs text-muted-foreground">
              {t("variantBName")}
            </Label>
            <Input id="exp-b" name="variantBName" placeholder={t("variantBPlaceholder")} required className="h-9" />
          </div>
          <div>
            <Label htmlFor="exp-metric" className="mb-1 block text-xs text-muted-foreground">
              {t("metric")}
            </Label>
            <Input id="exp-metric" name="metricLabel" defaultValue={t("metricDefault")} className="h-9" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="exp-hypothesis" className="mb-1 block text-xs text-muted-foreground">
              {t("hypothesis")}
            </Label>
            <Textarea id="exp-hypothesis" name="hypothesis" rows={2} />
          </div>
          <Button type="submit" disabled={isPending} className="h-9 w-fit gap-1.5 sm:col-span-2">
            <Plus className="size-3.5" />
            {isPending ? t("creating") : t("create")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ExperimentCard({ experiment, canManage }: { experiment: ExperimentRow; canManage: boolean }) {
  const t = useTranslations("analytics.experiments");
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(recordExperimentResultAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("resultRecorded"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{experiment.name}</span>
          <Badge variant={experiment.status === "completed" ? "secondary" : "outline"}>
            {experiment.status === "completed" ? t("statusCompleted") : t("statusRunning")}
          </Badge>
        </CardTitle>
        <CardDescription>{t(CATEGORY_KEYS[experiment.category] ?? "categoryConfirmationScript")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {experiment.hypothesis ? <p className="text-muted-foreground">{experiment.hypothesis}</p> : null}

        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-md border p-2 ${experiment.winner === "a" ? "border-emerald-500" : ""}`}>
            <p className="text-xs text-muted-foreground">{experiment.variant_a_name}</p>
            <p className="font-semibold tabular-nums">{experiment.variant_a_metric_value ?? "—"}</p>
          </div>
          <div className={`rounded-md border p-2 ${experiment.winner === "b" ? "border-emerald-500" : ""}`}>
            <p className="text-xs text-muted-foreground">{experiment.variant_b_name}</p>
            <p className="font-semibold tabular-nums">{experiment.variant_b_metric_value ?? "—"}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{experiment.metric_label}</p>

        {canManage ? (
          editing ? (
            <form action={formAction} className="space-y-2 border-t pt-3">
              <input type="hidden" name="experimentId" value={experiment.id} />
              <div className="grid grid-cols-2 gap-2">
                <Input name="variantAMetricValue" type="number" step="0.01" placeholder={experiment.variant_a_name} defaultValue={experiment.variant_a_metric_value ?? ""} className="h-8" />
                <Input name="variantBMetricValue" type="number" step="0.01" placeholder={experiment.variant_b_name} defaultValue={experiment.variant_b_metric_value ?? ""} className="h-8" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select name="status" defaultValue={experiment.status}>
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="running">{t("statusRunning")}</SelectItem>
                    <SelectItem value="completed">{t("statusCompleted")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select name="winner" defaultValue={experiment.winner ?? undefined}>
                  <SelectTrigger className="h-8 w-full">
                    <SelectValue placeholder={t("winner")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a">{experiment.variant_a_name}</SelectItem>
                    <SelectItem value="b">{experiment.variant_b_name}</SelectItem>
                    <SelectItem value="inconclusive">{t("inconclusive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea name="notes" placeholder={t("notes")} rows={2} defaultValue={experiment.notes ?? ""} />
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
            <Button size="sm" variant="outline" className="h-8" onClick={() => setEditing(true)}>
              {t("recordResult")}
            </Button>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
