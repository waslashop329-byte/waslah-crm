import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Sparkles, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listRecentInsights } from "@/lib/ai/services/business-insights-service";
import { InsightCard } from "@/components/ai/insight-card";
import { GenerateInsightsButton } from "@/components/ai/generate-insights-button";
import { EmptyState } from "@/components/shared/empty-state";

export default async function AiInsightsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("aiInsightsPage");

  if (!user.can("ai.insights.view")) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />
      </div>
    );
  }

  const insights = await listRecentInsights();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <GenerateInsightsButton />
      </div>

      {insights.length === 0 ? (
        <EmptyState icon={Sparkles} title={t("noInsightsTitle")} description={t("noInsightsDescription")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}
    </div>
  );
}
