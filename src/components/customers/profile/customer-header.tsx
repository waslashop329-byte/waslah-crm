import { format } from "date-fns";
import { getTranslations, getLocale } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { ScoreBadge } from "@/components/customers/score-badge";
import { CustomerQuickActions } from "@/components/customers/customer-quick-actions";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { CustomerDetail } from "@/lib/repositories/customer-detail-repository";
import type { TagRow } from "@/lib/types/database";

const STATUS_KEYS: Record<string, string> = {
  active: "statusActive",
  inactive: "statusInactive",
  blocked: "statusBlocked",
  merged: "statusMerged",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  inactive: "bg-muted text-muted-foreground",
  blocked: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  merged: "bg-muted text-muted-foreground",
};

interface CustomerHeaderProps {
  customer: CustomerDetail;
  allTags: TagRow[];
  employees: { id: string; full_name: string }[];
}

export async function CustomerHeader({ customer, allTags, employees }: CustomerHeaderProps) {
  const t = await getTranslations("customerProfile.header");
  const locale = (await getLocale()) as Locale;
  const dateLocale = getDateFnsLocale(locale);
  const primaryPhone = customer.phones.find((p) => p.is_primary) ?? customer.phones[0];

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{customer.full_name}</h1>
          <Badge variant="outline" className={`border-transparent ${STATUS_STYLES[customer.status]}`}>
            {t(STATUS_KEYS[customer.status])}
          </Badge>
          <ScoreBadge score={customer.score} category={customer.score_category} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {primaryPhone ? <span>{primaryPhone.phone}</span> : null}
          {customer.email ? <span>{customer.email}</span> : null}
          <span>{t("customerSince", { date: format(new Date(customer.customer_since), "MMM d, yyyy", { locale: dateLocale }) })}</span>
        </div>

        {customer.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {customer.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary">
                {tag.name}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <CustomerQuickActions customerId={customer.id} tags={allTags} employees={employees} />
    </div>
  );
}
