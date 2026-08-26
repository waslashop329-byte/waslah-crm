import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { getTranslations, getLocale } from "next-intl/server";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getSyncRun, listSyncRunItems } from "@/lib/repositories/sync-log-repository";
import { getIntegration } from "@/lib/repositories/integration-repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SyncRunStatusBadge } from "@/components/sync-logs/sync-run-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ScrollText } from "lucide-react";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";

const ITEM_STATUS_STYLES: Record<string, string> = {
  success: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const ITEM_STATUS_KEYS: Record<string, string> = {
  success: "success",
  failed: "failed",
  skipped: "skipped",
};

export default async function SyncRunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("syncLogsPage.detail");
  const tItemStatus = await getTranslations("syncLogsPage.itemStatus");
  const locale = (await getLocale()) as Locale;
  const dateLocale = getDateFnsLocale(locale);

  if (!user.can("integrations.manage")) {
    const tRestricted = await getTranslations("syncLogsPage");
    return <EmptyState icon={ShieldAlert} title={tRestricted("restricted")} description={tRestricted("noPermission")} />;
  }

  const { runId } = await params;
  const run = await getSyncRun(runId);
  if (!run) notFound();

  const [items, integration] = await Promise.all([listSyncRunItems(runId), run.integration_id ? getIntegration(run.integration_id) : null]);

  const failedItems = items.filter((item) => item.status === "failed");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 gap-1.5" asChild>
          <Link href="/sync-logs">
            <ArrowLeft className="size-3.5 rtl:rotate-180" />
            {t("backToSyncLogs")}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {integration?.name ?? run.source} · {format(new Date(run.started_at), "MMM d, yyyy HH:mm:ss", { locale: dateLocale })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("summary")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={t("status")} value={<SyncRunStatusBadge status={run.status} />} />
          <Stat label={t("type")} value={<span className="capitalize">{run.sync_type}</span>} />
          <Stat label={t("totalRecords")} value={run.total_records} />
          <Stat label={t("successful")} value={run.successful_records} tone="success" />
          <Stat label={t("failed")} value={run.failed_records} tone="danger" />
          <Stat label={t("retryCount")} value={run.retry_count} />
          <Stat label={t("started")} value={format(new Date(run.started_at), "HH:mm:ss")} />
          <Stat label={t("finished")} value={run.finished_at ? format(new Date(run.finished_at), "HH:mm:ss") : "—"} />
        </CardContent>
        {run.error_summary ? (
          <CardContent className="pt-0">
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{run.error_summary}</p>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("recordsCount", { count: items.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <EmptyState icon={ScrollText} title={t("noRecordsTitle")} description={t("noRecordsDescription")} />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.entity")}</TableHead>
                    <TableHead>{t("table.externalId")}</TableHead>
                    <TableHead>{t("table.status")}</TableHead>
                    <TableHead>{t("table.error")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...failedItems, ...items.filter((i) => i.status !== "failed")].map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="capitalize">{item.entity_type}</TableCell>
                      <TableCell className="font-mono text-xs">{item.external_id ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ITEM_STATUS_STYLES[item.status] ?? "border-transparent bg-muted text-muted-foreground"}>
                          {tItemStatus(ITEM_STATUS_KEYS[item.status] ?? "skipped")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate text-xs text-destructive">{item.error ?? ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "success" | "danger" }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === "success"
            ? "text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
            : tone === "danger"
              ? "text-lg font-semibold tabular-nums text-red-700 dark:text-red-400"
              : "text-lg font-semibold tabular-nums"
        }
      >
        {value}
      </p>
    </div>
  );
}
