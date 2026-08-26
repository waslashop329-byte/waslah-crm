import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DollarSign, CalendarDays, CalendarRange, Activity, AlertTriangle, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getAiUsageSummary, type CostBreakdownEntry } from "@/lib/repositories/ai-usage-repository";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatCost(value: number): string {
  return `$${value.toFixed(2)}`;
}

export default async function AiUsagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("aiUsagePage");

  if (!user.can("ai.usage.view")) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />
      </div>
    );
  }

  const summary = await getAiUsageSummary();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {summary.anyCostEstimated ? (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          <AlertTriangle className="size-3.5 shrink-0" />
          {t("estimatedCostNote")}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <CostKpiCard label={t("costToday")} value={summary.costToday} icon={DollarSign} />
        <CostKpiCard label={t("cost7d")} value={summary.costLast7d} icon={CalendarDays} />
        <CostKpiCard label={t("cost30d")} value={summary.costLast30d} icon={CalendarRange} />
        <KpiCard
          label={t("calls30d")}
          value={summary.callsLast30d}
          icon={Activity}
          suffix={summary.failedCallsLast30d > 0 ? t("failedSuffix", { count: summary.failedCallsLast30d }) : undefined}
          tone={summary.failedCallsLast30d > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BreakdownCard title={t("costByFeature")} entries={summary.costByFeature} noUsageLabel={t("noUsageYet")} nameLabel={t("table.name")} callsLabel={t("table.calls")} costLabel={t("table.cost")} />
        <BreakdownCard title={t("costByModel")} entries={summary.costByModel} noUsageLabel={t("noUsageYet")} nameLabel={t("table.name")} callsLabel={t("table.calls")} costLabel={t("table.cost")} />
        <BreakdownCard title={t("costByUser")} entries={summary.costByUser} noUsageLabel={t("noUsageYet")} nameLabel={t("table.name")} callsLabel={t("table.calls")} costLabel={t("table.cost")} />
      </div>
    </div>
  );
}

function CostKpiCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof DollarSign }) {
  return (
    <Card className="gap-2 py-4">
      <CardHeader className="flex-row items-center justify-between px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-foreground" />
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-2xl font-semibold tabular-nums">{formatCost(value)}</p>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({
  title,
  entries,
  noUsageLabel,
  nameLabel,
  callsLabel,
  costLabel,
}: {
  title: string;
  entries: CostBreakdownEntry[];
  noUsageLabel: string;
  nameLabel: string;
  callsLabel: string;
  costLabel: string;
}) {
  const maxCost = Math.max(1, ...entries.map((e) => e.cost));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{noUsageLabel}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{nameLabel}</TableHead>
                <TableHead className="text-right">{callsLabel}</TableHead>
                <TableHead className="text-right">{costLabel}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.slice(0, 8).map((entry) => (
                <TableRow key={entry.key}>
                  <TableCell className="max-w-32 truncate" title={entry.label}>
                    <div className="flex flex-col gap-1">
                      <span className="truncate text-xs">{entry.label}</span>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${Math.round((entry.cost / maxCost) * 100)}%` }} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{entry.calls}</TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{formatCost(entry.cost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
