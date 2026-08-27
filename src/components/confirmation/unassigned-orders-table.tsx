"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { Inbox } from "lucide-react";
import { assignOrderAction, autoAssignAllAction, type ConfirmationActionState } from "@/app/(dashboard)/confirmation/actions";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { MissionOrder } from "@/lib/repositories/confirmation-repository";

const currency = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });
const initialState: ConfirmationActionState = {};

interface Employee {
  id: string;
  full_name: string;
}

export function UnassignedOrdersTable({ orders, employees, currentUserId }: { orders: MissionOrder[]; employees: Employee[]; currentUserId: string }) {
  const t = useTranslations("confirmation");

  if (orders.length === 0) {
    return <EmptyState icon={Inbox} title={t("unassigned.allCaughtUpTitle")} description={t("unassigned.allCaughtUpDescription")} />;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <AutoAssignButton />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.order")}</TableHead>
            <TableHead>{t("table.customer")}</TableHead>
            <TableHead className="text-right">{t("table.amount")}</TableHead>
            <TableHead>{t("table.ordered")}</TableHead>
            <TableHead className="min-w-60">{t("unassigned.assignTo")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <UnassignedRow key={order.id} order={order} employees={employees} currentUserId={currentUserId} />
          ))}
        </TableBody>
        </Table>
      </div>
    </div>
  );
}

function AutoAssignButton() {
  const t = useTranslations("confirmation");
  const [state, formAction, isPending] = useActionState(autoAssignAllAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("unassigned.autoAssignDone", { count: state.assignedCount ?? 0 }));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction}>
      <Button type="submit" size="sm" variant="outline" disabled={isPending}>
        {isPending ? t("unassigned.autoAssigning") : t("unassigned.autoAssignAll")}
      </Button>
    </form>
  );
}

function UnassignedRow({ order, employees, currentUserId }: { order: MissionOrder; employees: Employee[]; currentUserId: string }) {
  const t = useTranslations("confirmation");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);
  const [state, formAction, isPending] = useActionState(assignOrderAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("unassigned.orderAssigned"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{order.external_order_id ?? order.id.slice(0, 8)}</TableCell>
      <TableCell className="text-sm">{order.customer_full_name}</TableCell>
      <TableCell className="text-right tabular-nums">{currency.format(order.total_amount)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{format(new Date(order.ordered_at), "MMM d, yyyy", { locale: dateLocale })}</TableCell>
      <TableCell className="p-2">
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="orderId" value={order.id} />
          <Select name="agentId" defaultValue={currentUserId}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" variant="outline" disabled={isPending} className="h-8 shrink-0">
            {isPending ? t("unassigned.assigning") : t("unassigned.assign")}
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}
