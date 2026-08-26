import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listAutomationRules } from "@/lib/repositories/automation-repository";
import { getAllTags, getAssignableEmployees } from "@/lib/repositories/customer-repository";
import { AutomationsTable } from "@/components/automations/automations-table";
import { AutomationFormDialog } from "@/components/automations/automation-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";

export default async function AutomationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("automations");

  if (!user.can("automations.view")) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />
      </div>
    );
  }

  const canManage = user.can("automations.manage");
  const [rules, tags, employees] = await Promise.all([listAutomationRules(), getAllTags(), getAssignableEmployees()]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canManage ? <AutomationFormDialog mode="create" tags={tags} employees={employees} /> : null}
      </div>

      <AutomationsTable rules={rules} canManage={canManage} tags={tags} employees={employees} />
    </div>
  );
}
