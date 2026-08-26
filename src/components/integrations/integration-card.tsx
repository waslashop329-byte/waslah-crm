"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { Plug, RefreshCw, ScrollText } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IntegrationStatusBadge } from "@/components/integrations/integration-status-badge";
import { testConnectionAction, syncNowAction, type IntegrationActionState } from "@/app/(dashboard)/integrations/actions";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { IntegrationWithHealth } from "@/lib/repositories/integration-repository";

const initialState: IntegrationActionState = {};

export function IntegrationCard({ integration }: { integration: IntegrationWithHealth }) {
  const t = useTranslations("integrations");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);
  const [testState, testAction, testPending] = useActionState(testConnectionAction, initialState);
  const [syncState, syncActionFn, syncPending] = useActionState(syncNowAction, initialState);

  useEffect(() => {
    if (testState.success) toast.success(testState.message ?? t("connectionOk"));
    if (testState.error) toast.error(testState.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testState]);

  useEffect(() => {
    if (syncState.success) toast.success(syncState.message ?? t("syncCompleted"));
    if (syncState.error) toast.error(syncState.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncState]);

  const run = integration.lastRun;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-md bg-muted">
            <Plug className="size-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-base">{integration.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("provider", { provider: integration.provider })}</p>
          </div>
        </div>
        <IntegrationStatusBadge status={integration.status} />
      </CardHeader>

      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-y-1.5">
          <span className="text-muted-foreground">{t("lastSuccessfulSync")}</span>
          <span className="text-right">
            {integration.last_success_at ? formatDistanceToNow(new Date(integration.last_success_at), { addSuffix: true, locale: dateLocale }) : t("never")}
          </span>

          <span className="text-muted-foreground">{t("lastFailedSync")}</span>
          <span className="text-right">
            {integration.last_failure_at ? formatDistanceToNow(new Date(integration.last_failure_at), { addSuffix: true, locale: dateLocale }) : "—"}
          </span>

          <span className="text-muted-foreground">{t("lastRunRecords")}</span>
          <span className="text-right tabular-nums">
            {run ? `${t("recordsOk", { success: run.successful_records, total: run.total_records })}${run.failed_records > 0 ? t("recordsFailed", { count: run.failed_records }) : ""}` : "—"}
          </span>
        </div>

        {integration.capabilities && Array.isArray(integration.capabilities) ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {(integration.capabilities as string[]).map((cap) => (
              <Badge key={cap} variant="secondary" className="text-[10px]">
                {cap}
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex-wrap gap-2">
        <form action={testAction}>
          <input type="hidden" name="integrationId" value={integration.id} />
          <Button type="submit" variant="outline" size="sm" disabled={testPending}>
            {testPending ? t("testing") : t("testConnection")}
          </Button>
        </form>

        <form action={syncActionFn}>
          <input type="hidden" name="integrationId" value={integration.id} />
          <Button type="submit" variant="outline" size="sm" disabled={syncPending} className="gap-1.5">
            <RefreshCw className={syncPending ? "size-3.5 animate-spin" : "size-3.5"} />
            {syncPending ? t("syncing") : t("syncNow")}
          </Button>
        </form>

        <Button variant="ghost" size="sm" className="gap-1.5" asChild>
          <Link href={`/sync-logs?integration=${integration.id}`}>
            <ScrollText className="size-3.5" />
            {t("viewLogs")}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
