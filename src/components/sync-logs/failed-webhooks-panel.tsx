"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { RotateCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { retryWebhookEventAction, type RetryActionState } from "@/app/(dashboard)/sync-logs/actions";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { WebhookEventRow } from "@/lib/types/database";

const initialState: RetryActionState = {};

export function FailedWebhooksPanel({ events }: { events: WebhookEventRow[] }) {
  const t = useTranslations("syncLogsPage");

  if (events.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("failedWebhooksTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {events.map((event) => (
          <FailedWebhookRow key={event.id} event={event} />
        ))}
      </CardContent>
    </Card>
  );
}

function FailedWebhookRow({ event }: { event: WebhookEventRow }) {
  const t = useTranslations("syncLogsPage");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);
  const [state, formAction, isPending] = useActionState(retryWebhookEventAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("webhookReprocessed"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {event.source}
          </Badge>
          <span className="font-medium">{event.event_type}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: dateLocale })}
          </span>
          {event.retry_count > 0 ? (
            <span className="text-xs text-muted-foreground">{t("retries", { count: event.retry_count })}</span>
          ) : null}
        </div>
        {event.error ? <p className="mt-1 truncate text-xs text-destructive">{event.error}</p> : null}
      </div>
      <form action={formAction}>
        <input type="hidden" name="eventId" value={event.id} />
        <Button type="submit" variant="outline" size="sm" disabled={isPending} className="gap-1.5 shrink-0">
          <RotateCw className={isPending ? "size-3.5 animate-spin" : "size-3.5"} />
          {isPending ? t("retrying") : t("retry")}
        </Button>
      </form>
    </div>
  );
}
