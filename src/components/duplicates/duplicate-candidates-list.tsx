"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { ExternalLink, X, GitMerge, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Fingerprint } from "lucide-react";
import { ConfidenceBadge } from "@/components/duplicates/confidence-badge";
import { MergeDialog } from "@/components/duplicates/merge-dialog";
import {
  ignoreDuplicateAction,
  analyzeDuplicateAction,
  type DuplicateActionState,
  type DuplicateAnalysisState,
} from "@/app/(dashboard)/duplicates/actions";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { DuplicateCandidateWithCustomers } from "@/lib/repositories/duplicate-repository";

const initialState: DuplicateActionState = {};
const initialAnalysisState: DuplicateAnalysisState = {};

const RECOMMENDATION_STYLES: Record<string, string> = {
  merge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  review: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  keep_separate: "bg-muted text-muted-foreground",
};

const RECOMMENDATION_KEYS: Record<string, string> = {
  merge: "recommendationMerge",
  review: "recommendationReview",
  keep_separate: "recommendationKeepSeparate",
};

const STATUS_KEYS: Record<string, string> = {
  pending: "statusValuePending",
  ignored: "statusValueIgnored",
  merged: "statusValueMerged",
};

export function DuplicateCandidatesList({ candidates, canMerge }: { candidates: DuplicateCandidateWithCustomers[]; canMerge: boolean }) {
  const t = useTranslations("duplicates");

  if (candidates.length === 0) {
    return <EmptyState icon={Fingerprint} title={t("noCandidatesTitle")} description={t("noCandidatesDescription")} />;
  }

  return (
    <div className="space-y-3">
      {candidates.map((candidate) => (
        <CandidateCard key={candidate.id} candidate={candidate} canMerge={canMerge} />
      ))}
    </div>
  );
}

function CandidateCard({ candidate, canMerge }: { candidate: DuplicateCandidateWithCustomers; canMerge: boolean }) {
  const t = useTranslations("duplicates");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);
  const [state, formAction, isPending] = useActionState(ignoreDuplicateAction, initialState);
  const [analysisState, analyzeAction, analyzePending] = useActionState(analyzeDuplicateAction, initialAnalysisState);
  const [mergeOpen, setMergeOpen] = useState(false);

  useEffect(() => {
    if (state.success) toast.success(t("markedIgnored"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (analysisState.error) toast.error(analysisState.error);
  }, [analysisState]);

  const canAct = candidate.status === "pending" && canMerge && candidate.customerA && candidate.customerB;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 flex-wrap items-center gap-4">
            <CustomerLink customer={candidate.customerA} unknownLabel={t("unknownCustomer")} />
            <span className="text-xs text-muted-foreground">{t("vs")}</span>
            <CustomerLink customer={candidate.customerB} unknownLabel={t("unknownCustomer")} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(candidate.signals as string[]).map((signal) => (
              <Badge key={signal} variant="secondary" className="text-[10px]">
                {signal}
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <ConfidenceBadge confidence={candidate.confidence_score} />
            <Badge variant="outline" className="text-[10px] capitalize">
              {t(STATUS_KEYS[candidate.status] ?? "statusValuePending")}
            </Badge>
            <span className="text-xs text-muted-foreground">{format(new Date(candidate.created_at), "MMM d, yyyy", { locale: dateLocale })}</span>

            <form action={analyzeAction}>
              <input type="hidden" name="candidateId" value={candidate.id} />
              <Button type="submit" variant="ghost" size="sm" disabled={analyzePending} className="gap-1.5">
                {analyzePending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                {t("aiAnalysis")}
              </Button>
            </form>

            {canAct ? (
              <>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setMergeOpen(true)}>
                  <GitMerge className="size-3.5" />
                  {t("merge")}
                </Button>
                <form action={formAction}>
                  <input type="hidden" name="candidateId" value={candidate.id} />
                  <Button type="submit" variant="ghost" size="sm" disabled={isPending} className="gap-1.5">
                    <X className="size-3.5" />
                    {t("ignore")}
                  </Button>
                </form>
                {candidate.customerA && candidate.customerB ? (
                  <MergeDialog
                    open={mergeOpen}
                    onOpenChange={setMergeOpen}
                    candidateId={candidate.id}
                    customerA={candidate.customerA}
                    customerB={candidate.customerB}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {analysisState.result ? (
          <div className="rounded-md bg-muted p-3 text-sm">
            <div className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-purple-600 dark:text-purple-400" />
              <Badge variant="outline" className={`border-transparent text-[10px] capitalize ${RECOMMENDATION_STYLES[analysisState.result.recommendation]}`}>
                {t(RECOMMENDATION_KEYS[analysisState.result.recommendation] ?? "recommendationReview")}
              </Badge>
              <span className="text-xs text-muted-foreground">{t("confidencePercent", { percent: Math.round(analysisState.result.confidence * 100) })}</span>
            </div>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              {analysisState.result.reasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CustomerLink({ customer, unknownLabel }: { customer: { id: string; full_name: string; email: string | null } | null; unknownLabel: string }) {
  if (!customer) return <span className="text-sm text-muted-foreground">{unknownLabel}</span>;

  return (
    <Link href={`/customers/${customer.id}`} className="flex items-center gap-1 text-sm font-medium hover:underline">
      {customer.full_name}
      <ExternalLink className="size-3 text-muted-foreground" />
    </Link>
  );
}
