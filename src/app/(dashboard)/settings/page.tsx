import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/session";
import { getScoringRules, getScoreCategoryThresholds } from "@/lib/repositories/scoring-repository";
import { getLoyaltyTiers } from "@/lib/repositories/loyalty-repository";
import { getPerformanceConfig } from "@/lib/repositories/performance-repository";
import { ScoringConfigCard } from "@/components/settings/scoring-config-card";
import { LoyaltyConfigCard } from "@/components/settings/loyalty-config-card";
import { PerformanceConfigCard } from "@/components/settings/performance-config-card";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("settings");

  const canConfigureScoring = user.can("scores.configure");
  const canConfigureLoyalty = user.can("loyalty.manage");
  const canConfigurePerformance = user.can("performance.manage");
  const [rules, thresholds, loyaltyTiers, performanceConfig] = await Promise.all([
    canConfigureScoring ? getScoringRules() : Promise.resolve([]),
    canConfigureScoring ? getScoreCategoryThresholds() : Promise.resolve([]),
    canConfigureLoyalty ? getLoyaltyTiers() : Promise.resolve([]),
    canConfigurePerformance ? getPerformanceConfig() : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">{t("profile")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-1 text-sm">
            <span className="text-muted-foreground">{t("name")}</span>
            <span className="col-span-2 font-medium">{user.profile.full_name}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-sm">
            <span className="text-muted-foreground">{t("email")}</span>
            <span className="col-span-2 font-medium">{user.email}</span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-sm">
            <span className="text-muted-foreground">{t("role")}</span>
            <span className="col-span-2">
              <Badge variant="secondary">{user.role?.name ?? t("unassigned")}</Badge>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-sm">
            <span className="text-muted-foreground">{t("accessLevel")}</span>
            <span className="col-span-2 font-medium">
              {user.isFullAccess ? t("fullAccess") : t("scopedAccess")}
            </span>
          </div>
        </CardContent>
      </Card>

      {canConfigureScoring ? <ScoringConfigCard rules={rules} thresholds={thresholds} /> : null}
      {canConfigureLoyalty ? <LoyaltyConfigCard tiers={loyaltyTiers} /> : null}
      {canConfigurePerformance && performanceConfig ? <PerformanceConfigCard config={performanceConfig} /> : null}

      <p className="max-w-lg text-xs text-muted-foreground">{t("futurePhasesNote")}</p>
    </div>
  );
}
