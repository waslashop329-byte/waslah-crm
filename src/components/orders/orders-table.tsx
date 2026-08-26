import Link from "next/link";
import { format } from "date-fns";
import { getTranslations, getLocale } from "next-intl/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Package } from "lucide-react";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { OrderListRow } from "@/lib/repositories/order-repository";
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

export async function OrdersTable({ orders }: { orders: OrderListRow[] }) {
  const t = await getTranslations("ordersPage");
  const tStatus = await getTranslations("customerProfile.orders");
  const locale = (await getLocale()) as Locale;
  const dateLocale = getDateFnsLocale(locale);

  if (orders.length === 0) {
    return <EmptyState icon={Package} title={t("noOrdersTitle")} description={t("noOrdersDescription")} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.order")}</TableHead>
            <TableHead>{t("table.customer")}</TableHead>
            <TableHead>{t("table.product")}</TableHead>
            <TableHead>{t("table.status")}</TableHead>
            <TableHead className="text-right">{t("table.amount")}</TableHead>
            <TableHead>{t("table.ordered")}</TableHead>
            <TableHead>{t("table.delivered")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-mono text-xs">{order.external_order_id ?? order.id.slice(0, 8)}</TableCell>
              <TableCell className="text-sm">
                <Link href={`/customers/${order.customer_id}`} className="hover:underline">
                  {order.customer_full_name}
                </Link>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{order.product_summary ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="outline" className={`border-transparent ${STATUS_STYLES[order.status]}`}>
                  {tStatus(STATUS_KEYS[order.status])}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{currency.format(order.total_amount)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{format(new Date(order.ordered_at), "MMM d, yyyy", { locale: dateLocale })}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {order.delivered_at ? format(new Date(order.delivered_at), "MMM d, yyyy", { locale: dateLocale }) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
