"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/customers/score-badge";
import { recalculateScoreAction } from "@/app/(dashboard)/customers/[customerId]/actions";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { ActionState } from "@/app/(dashboard)/customers/actions";
import type { CustomerRow, ScoreHistoryRow } from "@/lib/types/database";

const initialState: ActionState = {};

export function ScoreHistoryCard({ customer, history }: { customer: CustomerRow; history: ScoreHistoryRow[] }) {
  const t = useTranslations("customerProfile.score");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);
  const [state, formAction, isPending] = useActionState(recalculateScoreAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(state.message ?? t("recalculated"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-sm">{t("title")}</CardTitle>
        <form action={formAction}>
          <input type="hidden" name="customerId" value={customer.id} />
          <Button type="submit" variant="ghost" size="sm" disabled={isPending} className="gap-1.5 text-xs">
            <RefreshCw className={isPending ? "size-3 animate-spin" : "size-3"} />
            {isPending ? t("recalculating") : t("recalculate")}
          </Button>
        </form>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-semibold tabular-nums">{customer.score}</span>
          <ScoreBadge score={customer.score} category={customer.score_category} />
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noChanges")}</p>
        ) : (
          <ul className="space-y-1.5">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2 text-sm">
                {entry.score_diff == null || entry.score_diff === 0 ? (
                  <Minus className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                ) : entry.score_diff > 0 ? (
                  <TrendingUp className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="mt-0.5 size-3.5 shrink-0 text-red-600 dark:text-red-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p>
                    <span
                      className={
                        entry.score_diff != null && entry.score_diff > 0
                          ? "font-medium text-emerald-700 dark:text-emerald-400"
                          : entry.score_diff != null && entry.score_diff < 0
                            ? "font-medium text-red-700 dark:text-red-400"
                            : "font-medium"
                      }
                    >
                      {entry.score_diff != null && entry.score_diff !== 0
                        ? `${entry.score_diff > 0 ? "+" : ""}${entry.score_diff}`
                        : t("noChange")}
                    </span>{" "}
                    <span className="text-muted-foreground">{entry.reason ?? entry.trigger_event ?? ""}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: dateLocale })}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
