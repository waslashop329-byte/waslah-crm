"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { format, isPast } from "date-fns";
import { CalendarClock, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { completeFollowUpAction, cancelFollowUpAction } from "@/app/(dashboard)/customers/[customerId]/actions";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { ActionState } from "@/app/(dashboard)/customers/actions";
import type { FollowUpRow } from "@/lib/types/database";

const initialState: ActionState = {};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  urgent: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const PRIORITY_KEYS: Record<string, string> = {
  low: "priorityLow",
  medium: "priorityMedium",
  high: "priorityHigh",
  urgent: "priorityUrgent",
};

const STATUS_KEYS: Record<string, string> = {
  pending: "statusPending",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
  overdue: "statusOverdue",
};

export function FollowUpsTab({ customerId, followUps, canManage }: { customerId: string; followUps: FollowUpRow[]; canManage: boolean }) {
  const t = useTranslations("customerProfile.followUps");

  if (followUps.length === 0) {
    return <EmptyState icon={CalendarClock} title={t("noFollowUpsTitle")} description={t("noFollowUpsDescription")} />;
  }

  return (
    <ul className="space-y-2">
      {followUps.map((followUp) => (
        <FollowUpItem key={followUp.id} customerId={customerId} followUp={followUp} canManage={canManage} />
      ))}
    </ul>
  );
}

function FollowUpItem({ customerId, followUp, canManage }: { customerId: string; followUp: FollowUpRow; canManage: boolean }) {
  const t = useTranslations("customerProfile.followUps");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);
  const [completeState, completeAction, completePending] = useActionState(completeFollowUpAction, initialState);
  const [cancelState, cancelActionFn, cancelPending] = useActionState(cancelFollowUpAction, initialState);

  useEffect(() => {
    if (completeState.error) toast.error(completeState.error);
    if (completeState.success) toast.success(t("completed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completeState]);

  useEffect(() => {
    if (cancelState.error) toast.error(cancelState.error);
    if (cancelState.success) toast.success(t("cancelled"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelState]);

  const overdue = followUp.status === "pending" && isPast(new Date(followUp.due_date));
  const displayStatus = overdue ? "overdue" : followUp.status;

  return (
    <li className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-medium">{followUp.title}</p>
          <Badge variant="outline" className={`border-transparent text-[10px] ${PRIORITY_STYLES[followUp.priority]}`}>
            {t(PRIORITY_KEYS[followUp.priority])}
          </Badge>
          <Badge
            variant="outline"
            className={`border-transparent text-[10px] ${
              displayStatus === "overdue"
                ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                : displayStatus === "completed"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {t(STATUS_KEYS[displayStatus])}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {t(`type${followUp.type.charAt(0).toUpperCase()}${followUp.type.slice(1)}`)} · {t("due", { date: format(new Date(followUp.due_date), "MMM d, yyyy HH:mm", { locale: dateLocale }) })}
        </p>
        {followUp.notes ? <p className="mt-1 text-sm text-muted-foreground">{followUp.notes}</p> : null}
      </div>

      {canManage && followUp.status === "pending" ? (
        <div className="flex shrink-0 gap-1">
          <form action={completeAction}>
            <input type="hidden" name="followUpId" value={followUp.id} />
            <input type="hidden" name="customerId" value={customerId} />
            <Button type="submit" variant="outline" size="icon" className="size-7" disabled={completePending}>
              <Check className="size-3.5" />
            </Button>
          </form>
          <form action={cancelActionFn}>
            <input type="hidden" name="followUpId" value={followUp.id} />
            <input type="hidden" name="customerId" value={customerId} />
            <Button type="submit" variant="outline" size="icon" className="size-7" disabled={cancelPending}>
              <X className="size-3.5" />
            </Button>
          </form>
        </div>
      ) : null}
    </li>
  );
}
