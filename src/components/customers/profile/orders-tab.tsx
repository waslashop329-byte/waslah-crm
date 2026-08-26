"use client";

import { Fragment, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { Package, ChevronDown, ChevronUp } from "lucide-react";
import { calculateOrderProfit } from "@/lib/intelligence/economics/order-profit";
import { updateOrderCostsAction } from "@/app/(dashboard)/customers/[customerId]/actions";
import { CallAttemptsSection } from "@/components/customers/profile/call-attempts-section";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { ActionState } from "@/app/(dashboard)/customers/actions";
import type { OrderWithItems } from "@/lib/repositories/customer-detail-repository";
import type { OrderStatus } from "@/lib/types/database";

const currency = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });

const STATUS_STYLES: Record<OrderStatus, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  shipped: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  returned: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  failed_delivery: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const STATUS_KEYS: Record<OrderStatus, string> = {
  new: "statusNew",
  pending: "statusPending",
  confirmed: "statusConfirmed",
  processing: "statusProcessing",
  shipped: "statusShipped",
  delivered: "statusDelivered",
  cancelled: "statusCancelled",
  returned: "statusReturned",
  failed_delivery: "statusFailedDelivery",
};

export function OrdersTab({ orders, canManageCosts, canAnalyzeCalls }: { orders: OrderWithItems[]; canManageCosts: boolean; canAnalyzeCalls: boolean }) {
  const t = useTranslations("customerProfile.orders");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (orders.length === 0) {
    return <EmptyState icon={Package} title={t("noOrdersTitle")} description={t("noOrdersDescription")} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>{t("order")}</TableHead>
            <TableHead>{t("product")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead className="text-right">{t("amount")}</TableHead>
            <TableHead className="text-right">{t("netProfit")}</TableHead>
            <TableHead>{t("ordered")}</TableHead>
            <TableHead>{t("delivered")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const profit = calculateOrderProfit(order, order.order_items);
            const isExpanded = expandedId === order.id;
            return (
              <Fragment key={order.id}>
                <TableRow className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                  <TableCell className="text-muted-foreground">
                    {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{order.external_order_id ?? order.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm">{order.product_summary ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`border-transparent ${STATUS_STYLES[order.status]}`}>
                      {t(STATUS_KEYS[order.status])}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{currency.format(order.total_amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {profit.netProfit !== null ? currency.format(profit.netProfit) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(order.ordered_at), "MMM d, yyyy", { locale: dateLocale })}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {order.delivered_at ? format(new Date(order.delivered_at), "MMM d, yyyy", { locale: dateLocale }) : "—"}
                  </TableCell>
                </TableRow>
                {isExpanded ? (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-muted/30 p-4">
                      <OrderDetail order={order} canManageCosts={canManageCosts} canAnalyzeCalls={canAnalyzeCalls} />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function OrderDetail({ order, canManageCosts, canAnalyzeCalls }: { order: OrderWithItems; canManageCosts: boolean; canAnalyzeCalls: boolean }) {
  const t = useTranslations("customerProfile.orders");
  const profit = calculateOrderProfit(order, order.order_items);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2" onClick={(e) => e.stopPropagation()}>
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">{t("lineItems")}</p>
        {order.order_items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noLineItems")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {order.order_items.map((item) => (
              <li key={item.id} className="flex justify-between">
                <span>
                  {item.quantity}× {item.product_name_raw}
                </span>
                <span className="tabular-nums text-muted-foreground">{currency.format(item.unit_price * item.quantity)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">{t("economics")}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("revenue")}</span>
            <span className="tabular-nums">{currency.format(profit.revenue)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("costOfGoods")}</span>
            <span className="tabular-nums">{profit.cogs !== null ? currency.format(profit.cogs) : t("unknown")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("netProfit")}</span>
            <span className="font-medium tabular-nums">{profit.netProfit !== null ? currency.format(profit.netProfit) : t("unknown")}</span>
          </div>
        </div>

        {canManageCosts ? (
          <OrderCostForm order={order} />
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">{t("adCost")}: {order.ad_cost !== null ? currency.format(order.ad_cost) : "—"}</span>
            <span className="text-muted-foreground">{t("shippingCost")}: {order.shipping_cost !== null ? currency.format(order.shipping_cost) : "—"}</span>
          </div>
        )}
      </div>

      <div className="md:col-span-2">
        <CallAttemptsSection attempts={order.order_call_attempts} customerId={order.customer_id} canAnalyze={canAnalyzeCalls} />
      </div>
    </div>
  );
}

const initialState: ActionState = {};

function OrderCostForm({ order }: { order: OrderWithItems }) {
  const t = useTranslations("customerProfile.orders");
  const [state, formAction, isPending] = useActionState(updateOrderCostsAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("costsUpdated"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="customerId" value={order.customer_id} />
      <div>
        <label htmlFor={`ad-cost-${order.id}`} className="mb-1 block text-xs text-muted-foreground">
          {t("adCost")}
        </label>
        <Input id={`ad-cost-${order.id}`} name="adCost" type="number" step="0.01" min={0} defaultValue={order.ad_cost ?? ""} placeholder="—" className="h-8 w-24" />
      </div>
      <div>
        <label htmlFor={`shipping-cost-${order.id}`} className="mb-1 block text-xs text-muted-foreground">
          {t("shippingCost")}
        </label>
        <Input
          id={`shipping-cost-${order.id}`}
          name="shippingCost"
          type="number"
          step="0.01"
          min={0}
          defaultValue={order.shipping_cost ?? ""}
          placeholder="—"
          className="h-8 w-28"
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={isPending} className="h-8">
        {isPending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
