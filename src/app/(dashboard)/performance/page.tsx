import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldAlert, Trophy } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getAgentLeaderboard, getAgentGoal, getGoalProgressForAgent } from "@/lib/repositories/performance-repository";
import { LeaderboardTable, type LeaderboardEntry } from "@/components/performance/leaderboard-table";
import { EmptyState } from "@/components/shared/empty-state";

export default async function PerformancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("performance");

  if (!user.can("performance.view")) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />
      </div>
    );
  }

  const canManage = user.can("performance.manage");
  const periodMonth = new Date().toISOString().slice(0, 7);
  const leaderboard = await getAgentLeaderboard();

  const entries: LeaderboardEntry[] = await Promise.all(
    leaderboard.map(async (performance) => {
      const goal = await getAgentGoal(performance.agentId, periodMonth);
      return { performance, goal, progress: getGoalProgressForAgent(performance, goal) };
    }),
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={Trophy} title={t("noActivityTitle")} description={t("noActivityDescription")} />
      ) : (
        <LeaderboardTable entries={entries} canManage={canManage} periodMonth={periodMonth} />
      )}
    </div>
  );
}
