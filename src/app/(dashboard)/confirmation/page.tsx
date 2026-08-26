import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PhoneCall, Users, Target, Repeat, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getTodaysMission, getUnassignedOrders, getAgentConfirmationKpis } from "@/lib/repositories/confirmation-repository";
import { getAssignableEmployees } from "@/lib/repositories/customer-repository";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MissionTable } from "@/components/confirmation/mission-table";
import { UnassignedOrdersTable } from "@/components/confirmation/unassigned-orders-table";
import { EmptyState } from "@/components/shared/empty-state";

export default async function ConfirmationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("confirmation");

  if (!user.can("orders.confirm")) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />
      </div>
    );
  }

  const canAssign = user.can("orders.assign");

  const [mission, kpis, unassigned, employees] = await Promise.all([
    getTodaysMission(user.userId),
    getAgentConfirmationKpis(user.userId),
    canAssign ? getUnassignedOrders() : Promise.resolve([]),
    canAssign ? getAssignableEmployees() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t("kpi.assigned")} value={kpis.assignedOrders} icon={Users} />
        <KpiCard label={t("kpi.confirmationRate")} value={kpis.confirmationRate ?? 0} icon={Target} suffix={kpis.confirmationRate !== null ? "%" : t("kpi.noData")} tone="success" />
        <KpiCard label={t("kpi.contactRate")} value={kpis.contactRate ?? 0} icon={PhoneCall} suffix={kpis.contactRate !== null ? "%" : t("kpi.noData")} />
        <KpiCard label={t("kpi.avgAttempts")} value={kpis.averageAttempts ?? 0} icon={Repeat} suffix={kpis.averageAttempts === null ? t("kpi.noData") : ""} />
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold">{t("myMission", { count: mission.length })}</h2>
        <MissionTable orders={mission} />
      </div>

      {canAssign ? (
        <div>
          <h2 className="mb-3 text-base font-semibold">{t("unassignedOrders", { count: unassigned.length })}</h2>
          <UnassignedOrdersTable orders={unassigned} employees={employees} currentUserId={user.userId} />
        </div>
      ) : null}
    </div>
  );
}
