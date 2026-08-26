import { format } from "date-fns";
import { getTranslations, getLocale } from "next-intl/server";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { CustomerRow } from "@/lib/types/database";

const currency = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });

export async function CustomerStats({ customer }: { customer: CustomerRow }) {
  const t = await getTranslations("customerProfile.stats");
  const locale = (await getLocale()) as Locale;
  const dateLocale = getDateFnsLocale(locale);

  // Orders in any non-final status (new/pending/confirmed/processing/shipped/
  // failed_delivery) never got their own stored counter — they're whatever's
  // left after subtracting the three final statuses from the total, so this
  // stays accurate without a schema change or extra sync-time bookkeeping.
  const pendingOrders = Math.max(
    0,
    customer.total_orders - customer.delivered_orders - customer.cancelled_orders - customer.returned_orders,
  );

  const stats: { label: string; value: string }[] = [
    { label: t("totalOrders"), value: customer.total_orders.toLocaleString() },
    { label: t("delivered"), value: customer.delivered_orders.toLocaleString() },
    { label: t("cancelled"), value: customer.cancelled_orders.toLocaleString() },
    { label: t("returned"), value: customer.returned_orders.toLocaleString() },
    { label: t("pending"), value: pendingOrders.toLocaleString() },
    { label: t("totalSpend"), value: currency.format(customer.total_spend) },
    { label: t("avgOrderValue"), value: currency.format(customer.avg_order_value) },
    { label: t("firstOrder"), value: customer.first_order_at ? format(new Date(customer.first_order_at), "MMM d, yyyy", { locale: dateLocale }) : "—" },
    { label: t("lastOrder"), value: customer.last_order_at ? format(new Date(customer.last_order_at), "MMM d, yyyy", { locale: dateLocale }) : "—" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">{stat.label}</p>
          <p className="text-lg font-semibold tabular-nums">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
