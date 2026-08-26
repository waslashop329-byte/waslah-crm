import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { getTranslations, getLocale } from "next-intl/server";
import { ArrowLeft, ShieldAlert, Workflow } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getAutomationRule, listAutomationExecutions } from "@/lib/repositories/automation-repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExecutionStatusBadge } from "@/components/automations/automation-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";

export default async function AutomationDetailPage({ params }: { params: Promise<{ ruleId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("automations");
  const locale = (await getLocale()) as Locale;
  const dateLocale = getDateFnsLocale(locale);

  if (!user.can("automations.view")) {
    return <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />;
  }

  const { ruleId } = await params;
  const rule = await getAutomationRule(ruleId);
  if (!rule) notFound();

  const { executions, total } = await listAutomationExecutions(ruleId);
  const completed = executions.filter((e) => e.status === "completed").length;
  const failed = executions.filter((e) => e.status === "failed").length;
  const skipped = executions.filter((e) => e.status === "skipped").length;
  const successRate = executions.length > 0 ? Math.round((completed / executions.length) * 100) : null;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 gap-1.5" asChild>
          <Link href="/automations">
            <ArrowLeft className="size-3.5 rtl:rotate-180" />
            {t("backToAutomations")}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{rule.name}</h1>
          <Badge variant={rule.is_active ? "secondary" : "outline"}>{rule.is_active ? t("table.active") : t("table.disabled")}</Badge>
        </div>
        <p className="font-mono text-sm text-muted-foreground">{rule.trigger_event}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("summary")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={t("totalExecutions")} value={total} />
          <Stat label={t("successRateLabel")} value={successRate !== null ? `${successRate}%` : "—"} />
          <Stat label={t("skippedNoMatch")} value={skipped} />
          <Stat label={t("failed")} value={failed} tone={failed > 0 ? "danger" : undefined} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("configuration")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">{t("conditions")}</p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2 text-xs">{JSON.stringify(rule.conditions, null, 2)}</pre>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("actions")}</p>
            <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-2 text-xs">{JSON.stringify(rule.actions, null, 2)}</pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("recentExecutions")}</CardTitle>
        </CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <EmptyState icon={Workflow} title={t("noExecutionsTitle")} description={t("noExecutionsDescription")} />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("executionsTable.started")}</TableHead>
                    <TableHead>{t("executionsTable.status")}</TableHead>
                    <TableHead>{t("executionsTable.error")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map((execution) => (
                    <TableRow key={execution.id}>
                      <TableCell className="text-sm">{format(new Date(execution.started_at), "MMM d, yyyy HH:mm:ss", { locale: dateLocale })}</TableCell>
                      <TableCell>
                        <ExecutionStatusBadge status={execution.status} />
                      </TableCell>
                      <TableCell className="max-w-md truncate text-xs text-destructive">{execution.error ?? ""}</TableCell>
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

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "danger" }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={tone === "danger" ? "text-lg font-semibold tabular-nums text-red-700 dark:text-red-400" : "text-lg font-semibold tabular-nums"}>
        {value}
      </p>
    </div>
  );
}
