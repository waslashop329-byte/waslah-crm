import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { getTranslations, getLocale } from "next-intl/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Workflow } from "lucide-react";
import { ToggleAutomationSwitch } from "@/components/automations/toggle-automation-switch";
import { AutomationFormDialog } from "@/components/automations/automation-form-dialog";
import { DeleteAutomationButton } from "@/components/automations/delete-automation-button";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { AutomationRuleWithStats } from "@/lib/repositories/automation-repository";
import type { SegmentConditions } from "@/lib/intelligence/segments/segment-schema";
import type { AutomationAction } from "@/lib/intelligence/automation/action-schema";
import type { TagRow } from "@/lib/types/database";

interface AutomationsTableProps {
  rules: AutomationRuleWithStats[];
  canManage: boolean;
  tags: TagRow[];
  employees: { id: string; full_name: string }[];
}

export async function AutomationsTable({ rules, canManage, tags, employees }: AutomationsTableProps) {
  const t = await getTranslations("automations");
  const locale = (await getLocale()) as Locale;
  const dateLocale = getDateFnsLocale(locale);

  if (rules.length === 0) {
    return <EmptyState icon={Workflow} title={t("noAutomationsTitle")} description={t("noAutomationsDescription")} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.name")}</TableHead>
            <TableHead>{t("table.trigger")}</TableHead>
            <TableHead>{t("table.status")}</TableHead>
            <TableHead className="text-right">{t("table.executions")}</TableHead>
            <TableHead className="text-right">{t("table.successRate")}</TableHead>
            <TableHead>{t("table.lastRun")}</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule) => (
            <TableRow key={rule.id}>
              <TableCell>
                <Link href={`/automations/${rule.id}`} className="font-medium hover:underline">
                  {rule.name}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{rule.trigger_event}</TableCell>
              <TableCell>
                {canManage ? <ToggleAutomationSwitch ruleId={rule.id} isActive={rule.is_active} /> : rule.is_active ? t("table.active") : t("table.disabled")}
              </TableCell>
              <TableCell className="text-right tabular-nums">{rule.executionCount}</TableCell>
              <TableCell className="text-right tabular-nums">{rule.successRate !== null ? `${rule.successRate}%` : "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {rule.lastExecutionAt ? formatDistanceToNow(new Date(rule.lastExecutionAt), { addSuffix: true, locale: dateLocale }) : t("table.never")}
              </TableCell>
              <TableCell>
                {canManage ? (
                  <div className="flex justify-end gap-1">
                    <AutomationFormDialog
                      mode="edit"
                      ruleId={rule.id}
                      initialName={rule.name}
                      initialTrigger={rule.trigger_event}
                      initialConditions={rule.conditions as unknown as SegmentConditions | null}
                      initialActions={rule.actions as unknown as AutomationAction[]}
                      tags={tags}
                      employees={employees}
                    />
                    <DeleteAutomationButton ruleId={rule.id} ruleName={rule.name} />
                  </div>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
