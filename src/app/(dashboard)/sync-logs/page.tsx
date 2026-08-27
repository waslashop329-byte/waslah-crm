import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listSyncRuns, listFailedWebhookEvents } from "@/lib/repositories/sync-log-repository";
import { listIntegrations } from "@/lib/repositories/integration-repository";
import { SyncLogsFilters } from "@/components/sync-logs/sync-logs-filters";
import { SyncRunsTable } from "@/components/sync-logs/sync-runs-table";
import { FailedWebhooksPanel } from "@/components/sync-logs/failed-webhooks-panel";
import { PaginationControls } from "@/components/customers/pagination-controls";
import { EmptyState } from "@/components/shared/empty-state";
import type { SyncRunStatus } from "@/lib/types/database";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SyncLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("syncLogsPage");

  if (!user.can("integrations.manage")) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />
      </div>
    );
  }

  const sp = await searchParams;
  const page = Number(first(sp.page)) || 1;

  const [{ runs, total, pageSize }, integrations, failedWebhooks] = await Promise.all([
    listSyncRuns({
      integrationId: first(sp.integration),
      status: first(sp.status) as SyncRunStatus | undefined,
      dateFrom: first(sp.dateFrom),
      dateTo: first(sp.dateTo),
      page,
    }),
    listIntegrations(),
    listFailedWebhookEvents(),
  ]);

  const integrationNames = Object.fromEntries(integrations.map((i) => [i.id, i.name]));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("runCount", { count: total.toLocaleString("en-US") })}</p>
      </div>

      <FailedWebhooksPanel events={failedWebhooks} />

      <SyncLogsFilters integrations={integrations.map((i) => ({ id: i.id, name: i.name }))} />

      <SyncRunsTable runs={runs} integrationNames={integrationNames} />

      <PaginationControls page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
