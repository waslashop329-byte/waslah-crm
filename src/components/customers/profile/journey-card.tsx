"use client";

import { format } from "date-fns";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { JourneyStage } from "@/lib/intelligence/sales/customer-journey";

const STAGE_KEYS: Record<string, string> = {
  first_order: "firstOrder",
  confirmed: "confirmed",
  delivered: "delivered",
  second_order: "secondOrder",
  vip: "vip",
};

export function JourneyCard({ stages }: { stages: JourneyStage[] }) {
  const t = useTranslations("customerProfile.journey");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex items-start justify-between gap-1">
          {stages.map((stage, index) => {
            const reached = stage.completedAt !== null;
            return (
              <li key={stage.key} className="flex flex-1 flex-col items-center gap-1.5 text-center">
                <div className="flex w-full items-center">
                  {index > 0 ? <div className={`h-px flex-1 ${reached ? "bg-primary" : "bg-border"}`} /> : <div className="flex-1" />}
                  <div
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] ${
                      reached ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"
                    }`}
                  >
                    {reached ? <Check className="size-3.5" /> : index + 1}
                  </div>
                  {index < stages.length - 1 ? <div className={`h-px flex-1 ${stages[index + 1].completedAt ? "bg-primary" : "bg-border"}`} /> : <div className="flex-1" />}
                </div>
                <p className="text-[11px] font-medium">{t(STAGE_KEYS[stage.key])}</p>
                <p className="text-[10px] text-muted-foreground">{reached ? format(new Date(stage.completedAt!), "MMM d, yyyy", { locale: dateLocale }) : "—"}</p>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
