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

  const stats: { label: string; value: string }[] = [
    { label: t("totalOrders"), value: customer.total_orders.toLocaleString() },
    { label: t("delivered"), value: customer.delivered_orders.toLocaleString() },
    { label: t("cancelled"), value: customer.cancelled_orders.toLocaleString() },
    { label: t("returned"), value: customer.returned_orders.toLocaleString() },
    { label: t("totalSpend"), value: currency.format(customer.total_spend) },
    { label: t("avgOrderValue"), value: currency.format(customer.avg_order_value) },
    { label: t("firstOrder"), value: customer.first_order_at ? format(new Date(customer.first_order_at), "MMM d, yyyy", { locale: dateLocale }) : "—" },
    { label: t("lastOrder"), value: customer.last_order_at ? format(new Date(customer.last_order_at), "MMM d, yyyy", { locale: dateLocale }) : "—" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">{stat.label}</p>
          <p className="text-lg font-semibold tabular-nums">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
