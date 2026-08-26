import { formatDistanceToNow } from "date-fns";
import { getTranslations, getLocale } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FeedbackButtons } from "@/components/ai/feedback-buttons";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { AiInsightRow } from "@/lib/types/database";

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const PRIORITY_KEYS: Record<string, string> = {
  low: "priorityLow",
  medium: "priorityMedium",
  high: "priorityHigh",
};

export async function InsightCard({ insight }: { insight: AiInsightRow }) {
  const t = await getTranslations("aiInsightsPage");
  const locale = (await getLocale()) as Locale;
  const dateLocale = getDateFnsLocale(locale);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle className="text-sm">{insight.title}</CardTitle>
          <Badge variant="secondary" className="mt-1 text-[10px] capitalize">
            {insight.category.replace("_", " ")}
          </Badge>
        </div>
        <Badge variant="outline" className={`border-transparent text-[10px] ${PRIORITY_STYLES[insight.priority] ?? ""}`}>
          {t(PRIORITY_KEYS[insight.priority] ?? "priorityLow")}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("fact")}</p>
          <p>{insight.fact_summary}</p>
        </div>
        {insight.inference ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t("inference")}</p>
            <p className="text-muted-foreground">{insight.inference}</p>
          </div>
        ) : null}
        {insight.recommended_action ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t("recommendation")}</p>
            <p className="text-muted-foreground">{insight.recommended_action}</p>
          </div>
        ) : null}

        <div className="flex items-center justify-between pt-1">
          <p className="text-[10px] text-muted-foreground">
            {insight.confidence !== null ? t("confidencePercent", { percent: Math.round(insight.confidence * 100) }) : ""}
            {formatDistanceToNow(new Date(insight.generated_at), { addSuffix: true, locale: dateLocale })}
          </p>
          <FeedbackButtons outputType="insight" outputId={insight.id} />
        </div>
      </CardContent>
    </Card>
  );
}
