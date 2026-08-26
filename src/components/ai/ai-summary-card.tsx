"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FeedbackButtons } from "@/components/ai/feedback-buttons";
import { generateSummaryAction, type AiActionState } from "@/app/(dashboard)/customers/[customerId]/ai-actions";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { AiCustomerSummaryRow } from "@/lib/types/database";

const initialState: AiActionState = {};

export function AiSummaryCard({ customerId, summary }: { customerId: string; summary: AiCustomerSummaryRow | null }) {
  const t = useTranslations("customerProfile.aiSummary");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);
  const [state, formAction, isPending] = useActionState(generateSummaryAction, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4 text-purple-600 dark:text-purple-400" />
          {t("title")}
        </CardTitle>
        <form action={formAction}>
          <input type="hidden" name="customerId" value={customerId} />
          <Button type="submit" variant="ghost" size="sm" disabled={isPending} className="gap-1.5 text-xs">
            <RefreshCw className={isPending ? "size-3 animate-spin" : "size-3"} />
            {summary ? t("refresh") : t("generate")}
          </Button>
        </form>
      </CardHeader>
      <CardContent className="space-y-3">
        {!summary ? (
          <p className="text-sm text-muted-foreground">{t("noSummaryYet")}</p>
        ) : (
          <>
            {summary.is_stale ? (
              <Badge variant="outline" className="gap-1 border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                <AlertTriangle className="size-3" />
                {t("dataChanged")}
              </Badge>
            ) : null}
            <p className="text-sm">{summary.summary}</p>

            {Array.isArray(summary.key_points) && summary.key_points.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
                {(summary.key_points as string[]).map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            ) : null}

            {Array.isArray(summary.concerns) && summary.concerns.length > 0 ? (
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">{t("concerns")}</p>
                <ul className="list-disc space-y-0.5 pl-4 text-sm text-amber-700 dark:text-amber-400">
                  {(summary.concerns as string[]).map((concern, i) => (
                    <li key={i}>{concern}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {summary.recommended_action ? (
              <p className="text-sm">
                <span className="font-medium">{t("suggested")}</span>
                {summary.recommended_action}
              </p>
            ) : null}

            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] text-muted-foreground">
                {t("generatedAgo", {
                  time: formatDistanceToNow(new Date(summary.generated_at), { addSuffix: true, locale: dateLocale }),
                  provider: summary.provider,
                  model: summary.model,
                })}
              </p>
              <FeedbackButtons outputType="customer_summary" outputId={customerId} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
