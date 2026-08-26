"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { Zap, Tag, Check, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FeedbackButtons } from "@/components/ai/feedback-buttons";
import {
  generateNextBestActionAction,
  generateTagSuggestionsAction,
  approveSuggestionAction,
  rejectSuggestionAction,
  type AiActionState,
} from "@/app/(dashboard)/customers/[customerId]/ai-actions";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { AiSuggestionRow } from "@/lib/types/database";

const initialState: AiActionState = {};

const TYPE_KEYS: Record<string, string> = {
  next_best_action: "typeNextBestAction",
  tag_suggestion: "typeTagSuggestion",
  duplicate_merge: "typeDuplicateMerge",
  new_tag_request: "typeNewTagRequest",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function AiSuggestionsCard({ customerId, suggestions }: { customerId: string; suggestions: AiSuggestionRow[] }) {
  const t = useTranslations("customerProfile.aiSuggestions");
  const [nbaState, nbaAction, nbaPending] = useActionState(generateNextBestActionAction, initialState);
  const [tagState, tagAction, tagPending] = useActionState(generateTagSuggestionsAction, initialState);

  useEffect(() => {
    if (nbaState.error) toast.error(nbaState.error);
  }, [nbaState]);
  useEffect(() => {
    if (tagState.error) toast.error(tagState.error);
    if (tagState.success && tagState.message) toast.info(tagState.message);
  }, [tagState]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Zap className="size-4 text-purple-600 dark:text-purple-400" />
          {t("title")}
        </CardTitle>
        <div className="flex gap-1">
          <form action={nbaAction}>
            <input type="hidden" name="customerId" value={customerId} />
            <Button type="submit" variant="outline" size="sm" disabled={nbaPending} className="h-7 gap-1 text-xs">
              {nbaPending ? <Loader2 className="size-3 animate-spin" /> : null}
              {t("nextAction")}
            </Button>
          </form>
          <form action={tagAction}>
            <input type="hidden" name="customerId" value={customerId} />
            <Button type="submit" variant="outline" size="sm" disabled={tagPending} className="h-7 gap-1 text-xs">
              {tagPending ? <Loader2 className="size-3 animate-spin" /> : <Tag className="size-3" />}
              {t("tags")}
            </Button>
          </form>
        </div>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noSuggestions")}</p>
        ) : (
          <ul className="space-y-2.5">
            {suggestions.map((suggestion) => (
              <SuggestionItem key={suggestion.id} suggestion={suggestion} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SuggestionItem({ suggestion }: { suggestion: AiSuggestionRow }) {
  const t = useTranslations("customerProfile.aiSuggestions");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);
  const [approveState, approveActionFn, approvePending] = useActionState(approveSuggestionAction, initialState);
  const [rejectState, rejectActionFn, rejectPending] = useActionState(rejectSuggestionAction, initialState);

  useEffect(() => {
    if (approveState.success) toast.success(t("applied"));
    if (approveState.error) toast.error(approveState.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveState]);
  useEffect(() => {
    if (rejectState.error) toast.error(rejectState.error);
  }, [rejectState]);

  return (
    <li className="rounded-md border p-2.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {t(TYPE_KEYS[suggestion.type] ?? "typeNextBestAction")}
            </Badge>
            {suggestion.priority ? (
              <Badge variant="outline" className={`border-transparent text-[10px] ${PRIORITY_STYLES[suggestion.priority] ?? ""}`}>
                {suggestion.priority}
              </Badge>
            ) : null}
            {suggestion.confidence !== null ? (
              <span className="text-[10px] text-muted-foreground">{t("confidence", { percent: Math.round(suggestion.confidence * 100) })}</span>
            ) : null}
          </div>
          <p className="mt-1 text-muted-foreground">{suggestion.reason}</p>
          {suggestion.suggested_timing ? <p className="text-xs text-muted-foreground">{t("timing", { timing: suggestion.suggested_timing })}</p> : null}
          <div className="mt-0.5 flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(suggestion.created_at), { addSuffix: true, locale: dateLocale })}</p>
            {suggestion.type === "next_best_action" || suggestion.type === "tag_suggestion" ? (
              <FeedbackButtons outputType={suggestion.type} outputId={suggestion.id} />
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 gap-1">
          <form action={approveActionFn}>
            <input type="hidden" name="suggestionId" value={suggestion.id} />
            <Button type="submit" variant="outline" size="icon" className="size-7" disabled={approvePending || rejectPending}>
              <Check className="size-3.5" />
            </Button>
          </form>
          <form action={rejectActionFn}>
            <input type="hidden" name="suggestionId" value={suggestion.id} />
            <Button type="submit" variant="outline" size="icon" className="size-7" disabled={approvePending || rejectPending}>
              <X className="size-3.5" />
            </Button>
          </form>
        </div>
      </div>
    </li>
  );
}
