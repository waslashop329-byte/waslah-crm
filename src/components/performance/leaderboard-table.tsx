"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";
import { setAgentGoalAction, type PerformanceActionState } from "@/app/(dashboard)/performance/actions";
import type { AgentPerformanceRow } from "@/lib/repositories/performance-repository";
import type { GoalProgress } from "@/lib/intelligence/performance/agent-performance";
import type { AgentGoalRow } from "@/lib/types/database";

const currency = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });
const initialState: PerformanceActionState = {};

export interface LeaderboardEntry {
  performance: AgentPerformanceRow;
  goal: AgentGoalRow | null;
  progress: GoalProgress;
}

export function LeaderboardTable({ entries, canManage, periodMonth }: { entries: LeaderboardEntry[]; canManage: boolean; periodMonth: string }) {
  const t = useTranslations("performance");

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">{t("rank")}</TableHead>
            <TableHead>{t("agent")}</TableHead>
            <TableHead className="text-right">{t("confirmed")}</TableHead>
            <TableHead className="text-right">{t("revenue")}</TableHead>
            <TableHead className="text-right">{t("xp")}</TableHead>
            <TableHead className="text-right">{t("commission")}</TableHead>
            <TableHead>{t("goalProgress")}</TableHead>
            {canManage ? <TableHead className="min-w-56">{t("setGoalFor", { period: periodMonth })}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry, index) => (
            <LeaderboardRow key={entry.performance.agentId} entry={entry} rank={index + 1} canManage={canManage} periodMonth={periodMonth} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LeaderboardRow({ entry, rank, canManage, periodMonth }: { entry: LeaderboardEntry; rank: number; canManage: boolean; periodMonth: string }) {
  const t = useTranslations("performance");
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(setAgentGoalAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("goalSaved"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const { performance, progress } = entry;

  return (
    <TableRow>
      <TableCell className="tabular-nums text-muted-foreground">{rank === 1 ? <Trophy className="size-4 text-amber-500" /> : rank}</TableCell>
      <TableCell className="text-sm font-medium">{performance.agentName}</TableCell>
      <TableCell className="text-right tabular-nums">{performance.confirmedOrders}</TableCell>
      <TableCell className="text-right tabular-nums">{currency.format(performance.confirmedRevenue)}</TableCell>
      <TableCell className="text-right tabular-nums">
        <Badge variant="secondary">{performance.xp} {t("xp")}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">{currency.format(performance.commission)}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {progress.ordersProgress !== null ? t("ordersProgress", { percent: progress.ordersProgress }) : t("noGoal")}
        {progress.revenueProgress !== null ? ` · ${t("revenueProgress", { percent: progress.revenueProgress })}` : ""}
      </TableCell>
      {canManage ? (
        <TableCell className="p-2">
          {editing ? (
            <form action={formAction} className="flex items-center gap-1.5">
              <input type="hidden" name="agentId" value={performance.agentId} />
              <input type="hidden" name="periodMonth" value={periodMonth} />
              <Input name="targetConfirmedOrders" type="number" min={0} placeholder={t("ordersPlaceholder")} defaultValue={entry.goal?.target_confirmed_orders ?? ""} className="h-8 w-20" />
              <Input name="targetRevenue" type="number" min={0} placeholder={t("revenuePlaceholder")} defaultValue={entry.goal?.target_revenue ?? ""} className="h-8 w-24" />
              <Button type="submit" size="sm" variant="outline" disabled={isPending} className="h-8 shrink-0">
                {isPending ? t("saving") : t("save")}
              </Button>
            </form>
          ) : (
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEditing(true)}>
              {t("setGoal")}
            </Button>
          )}
        </TableCell>
      ) : null}
    </TableRow>
  );
}
