import Link from "next/link";
import { format } from "date-fns";
import { getTranslations, getLocale } from "next-intl/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ScrollText } from "lucide-react";
import { SyncRunStatusBadge } from "@/components/sync-logs/sync-run-status-badge";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { SyncRunRow } from "@/lib/types/database";

interface SyncRunsTableProps {
  runs: SyncRunRow[];
  integrationNames: Record<string, string>;
}

function duration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return "—";
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export async function SyncRunsTable({ runs, integrationNames }: SyncRunsTableProps) {
  const t = await getTranslations("syncLogsPage");
  const locale = (await getLocale()) as Locale;
  const dateLocale = getDateFnsLocale(locale);

  if (runs.length === 0) {
    return <EmptyState icon={ScrollText} title={t("noRunsTitle")} description={t("noRunsDescription")} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.started")}</TableHead>
            <TableHead>{t("table.integration")}</TableHead>
            <TableHead>{t("table.type")}</TableHead>
            <TableHead>{t("table.status")}</TableHead>
            <TableHead className="text-right">{t("table.total")}</TableHead>
            <TableHead className="text-right">{t("table.success")}</TableHead>
            <TableHead className="text-right">{t("table.failed")}</TableHead>
            <TableHead>{t("table.duration")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell>
                <Link href={`/sync-logs/${run.id}`} className="hover:underline">
                  {format(new Date(run.started_at), "MMM d, yyyy HH:mm", { locale: dateLocale })}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{integrationNames[run.integration_id ?? ""] ?? run.source}</TableCell>
              <TableCell className="text-sm capitalize text-muted-foreground">{run.sync_type}</TableCell>
              <TableCell>
                <SyncRunStatusBadge status={run.status} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{run.total_records}</TableCell>
              <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">{run.successful_records}</TableCell>
              <TableCell className="text-right tabular-nums text-red-700 dark:text-red-400">{run.failed_records}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{duration(run.started_at, run.finished_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
