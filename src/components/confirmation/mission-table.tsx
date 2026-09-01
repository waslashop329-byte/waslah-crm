"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PhoneCall } from "lucide-react";
import { logCallAttemptAction, type ConfirmationActionState } from "@/app/(dashboard)/confirmation/actions";
import { getDateFnsLocale } from "@/lib/date-locale";
import { getConfirmationAlert, getHoursSinceLastAttempt } from "@/lib/intelligence/confirmation/confirmation-alerts";
import type { Locale } from "@/i18n/request";
import type { MissionOrder } from "@/lib/repositories/confirmation-repository";

const currency = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });
const initialState: ConfirmationActionState = {};

const RESULT_KEYS: { value: string; key: string }[] = [
  { value: "confirmed", key: "resultConfirmed" },
  { value: "no_answer", key: "resultNoAnswer" },
  { value: "cancelled", key: "resultCancelled" },
  { value: "reschedule", key: "resultReschedule" },
  { value: "invalid_number", key: "resultInvalidNumber" },
];

const REASON_KEYS: { value: string; key: string }[] = [
  { value: "price", key: "reasonPrice" },
  { value: "changed_mind", key: "reasonChangedMind" },
  { value: "found_elsewhere", key: "reasonFoundElsewhere" },
  { value: "delivery_time", key: "reasonDeliveryTime" },
  { value: "product_mismatch", key: "reasonProductMismatch" },
  { value: "other", key: "reasonOther" },
];

export function MissionTable({ orders }: { orders: MissionOrder[] }) {
  const t = useTranslations("confirmation");

  if (orders.length === 0) {
    return <EmptyState icon={PhoneCall} title={t("mission.clearTitle")} description={t("mission.clearDescription")} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.order")}</TableHead>
            <TableHead>{t("table.customer")}</TableHead>
            <TableHead className="text-right">{t("table.amount")}</TableHead>
            <TableHead>{t("table.ordered")}</TableHead>
            <TableHead className="min-w-72">{t("mission.logCallAttempt")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <MissionRow key={order.id} order={order} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MissionRow({ order }: { order: MissionOrder }) {
  const t = useTranslations("confirmation");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);
  const [state, formAction, isPending] = useActionState(logCallAttemptAction, initialState);
  const [result, setResult] = useState("confirmed");

  useEffect(() => {
    if (state.success) toast.success(t("mission.attemptLogged"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const alert = getConfirmationAlert(order.ordered_at, order.call_attempts);
  const hoursSinceLastAttempt = getHoursSinceLastAttempt(order.call_attempts);

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">
        <div className="flex items-center gap-1.5">
          {order.external_order_code ?? order.external_order_id ?? order.id.slice(0, 8)}
          {alert === "escalate" ? <Badge variant="destructive">{t("alerts.escalate")}</Badge> : null}
          {alert === "overdue" ? (
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
              {t("alerts.overdue")}
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-sm">{order.customer_full_name}</TableCell>
      <TableCell className="text-right tabular-nums">{currency.format(order.total_amount)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{format(new Date(order.ordered_at), "MMM d, yyyy", { locale: dateLocale })}</TableCell>
      <TableCell className="p-2">
        <form action={formAction} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <input type="hidden" name="orderId" value={order.id} />
            <Select name="result" value={result} onValueChange={setResult}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESULT_KEYS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(`mission.${option.key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {result === "cancelled" ? (
              <Select name="reasonCategory" defaultValue="other">
                <SelectTrigger className="h-8 w-36">
                  <SelectValue placeholder={t("mission.reasonPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {REASON_KEYS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(`mission.${option.key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Textarea name="notes" placeholder={t("mission.notesPlaceholder")} rows={1} className="h-8 min-h-8 w-40 resize-none py-1.5 text-xs" />
            <Button type="submit" size="sm" variant="outline" disabled={isPending} className="h-8 shrink-0">
              {isPending ? t("mission.saving") : t("mission.log")}
            </Button>
          </div>
          {hoursSinceLastAttempt !== null && hoursSinceLastAttempt < 4 ? (
            <span className="text-[11px] text-muted-foreground">{t("mission.lastAttemptRecent", { hours: Math.max(0, Math.round(hoursSinceLastAttempt)) })}</span>
          ) : null}
        </form>
      </TableCell>
    </TableRow>
  );
}
