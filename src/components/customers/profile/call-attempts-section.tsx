"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { analyzeCallNoteAction } from "@/app/(dashboard)/customers/[customerId]/actions";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { ActionState } from "@/app/(dashboard)/customers/actions";
import type { OrderWithItems } from "@/lib/repositories/customer-detail-repository";

const initialState: ActionState = {};

export function CallAttemptsSection({
  attempts,
  customerId,
  canAnalyze,
}: {
  attempts: OrderWithItems["order_call_attempts"];
  customerId: string;
  canAnalyze: boolean;
}) {
  const t = useTranslations("customerProfile.orders");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);

  if (attempts.length === 0) return null;

  return (
    <div className="mt-4 border-t pt-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t("callAttempts")}</p>
      <ul className="space-y-2">
        {attempts.map((attempt) => (
          <li key={attempt.id} className="rounded-md border p-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium capitalize">{attempt.result.replace("_", " ")}</span>
              <span className="text-xs text-muted-foreground">{format(new Date(attempt.attempted_at), "MMM d, yyyy HH:mm", { locale: dateLocale })}</span>
            </div>
            {attempt.reason_category ? <p className="mt-0.5 text-xs text-muted-foreground capitalize">{t("reason", { reason: attempt.reason_category.replace(/_/g, " ") })}</p> : null}
            {attempt.notes ? <p className="mt-1 text-muted-foreground">{attempt.notes}</p> : null}

            {attempt.notes ? (
              attempt.call_attempt_analysis ? (
                <div className="mt-2 space-y-1 rounded-md bg-muted/50 p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t("quality", { score: attempt.call_attempt_analysis.quality_score ?? 0 })}</Badge>
                    {attempt.call_attempt_analysis.attempted_upsell ? <Badge variant="outline">{t("upsellAttempted")}</Badge> : null}
                  </div>
                  {attempt.call_attempt_analysis.customer_objection ? (
                    <p>
                      <span className="text-muted-foreground">{t("objection")}</span>
                      {attempt.call_attempt_analysis.customer_objection}
                    </p>
                  ) : null}
                  {attempt.call_attempt_analysis.improvement_suggestion ? (
                    <p>
                      <span className="text-muted-foreground">{t("suggestion")}</span>
                      {attempt.call_attempt_analysis.improvement_suggestion}
                    </p>
                  ) : null}
                </div>
              ) : canAnalyze ? (
                <AnalyzeButton callAttemptId={attempt.id} customerId={customerId} />
              ) : null
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnalyzeButton({ callAttemptId, customerId }: { callAttemptId: string; customerId: string }) {
  const t = useTranslations("customerProfile.orders");
  const [state, formAction, isPending] = useActionState(analyzeCallNoteAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("callNoteAnalyzed"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="mt-1.5">
      <input type="hidden" name="callAttemptId" value={callAttemptId} />
      <input type="hidden" name="customerId" value={customerId} />
      <Button type="submit" size="sm" variant="outline" disabled={isPending} className="h-7 text-xs">
        {isPending ? t("analyzing") : t("analyzeWithAi")}
      </Button>
    </form>
  );
}
