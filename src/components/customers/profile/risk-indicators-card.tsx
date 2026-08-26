"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { RiskExplanationButton } from "@/components/ai/risk-explanation-button";
import type { CustomerRiskProfileRow, RiskLevel } from "@/lib/types/database";

const RISK_STYLES: Record<RiskLevel, string> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const RISK_KEYS: Record<RiskLevel, string> = {
  low: "riskLow",
  medium: "riskMedium",
  high: "riskHigh",
};

export function RiskIndicatorsCard({ profile, customerId }: { profile: CustomerRiskProfileRow | null; customerId: string }) {
  const t = useTranslations("customerProfile.risk");

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState icon={ShieldAlert} title={t("notCalculatedTitle")} description={t("notCalculatedDescription")} />
        </CardContent>
      </Card>
    );
  }

  const rows: { label: string; value: number; category: RiskLevel }[] = [
    { label: t("cancellationRisk"), value: profile.cancellation_risk, category: profile.cancellation_risk_category },
    { label: t("deliveryRisk"), value: profile.delivery_risk, category: profile.delivery_risk_category },
    { label: t("returnRisk"), value: profile.return_risk, category: profile.return_risk_category },
    { label: t("overallRisk"), value: profile.overall_risk, category: profile.overall_risk_category },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm tabular-nums">{row.value.toFixed(1)}%</span>
              <Badge variant="outline" className={`border-transparent text-[10px] ${RISK_STYLES[row.category]}`}>
                {t(RISK_KEYS[row.category])}
              </Badge>
            </div>
          </div>
        ))}
        <RiskExplanationButton customerId={customerId} />
      </CardContent>
    </Card>
  );
}
