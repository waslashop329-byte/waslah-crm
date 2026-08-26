"use client";

import { formatDistanceToNow } from "date-fns";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { ComplaintRow } from "@/lib/types/database";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  closed: "bg-muted text-muted-foreground",
};

const STATUS_KEYS: Record<string, string> = {
  open: "statusOpen",
  in_progress: "statusInProgress",
  resolved: "statusResolved",
  closed: "statusClosed",
};

const TYPE_KEYS: Record<string, string> = {
  complaint: "typeComplaint",
  inquiry: "typeInquiry",
  product_issue: "typeProductIssue",
  shipping_issue: "typeShippingIssue",
  refund_request: "typeRefundRequest",
  replacement_request: "typeReplacementRequest",
  warranty: "typeWarranty",
};

export function ComplaintsCard({ complaints }: { complaints: ComplaintRow[] }) {
  const t = useTranslations("customerProfile.complaints");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {complaints.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noComplaints")}</p>
        ) : (
          <ul className="space-y-2.5">
            {complaints.slice(0, 5).map((complaint) => (
              <li key={complaint.id} className="space-y-1 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{complaint.subject}</span>
                  <Badge variant="outline" className={`shrink-0 border-transparent text-[10px] ${STATUS_STYLES[complaint.status]}`}>
                    {t(STATUS_KEYS[complaint.status])}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t(TYPE_KEYS[complaint.type] ?? "typeComplaint")} · {formatDistanceToNow(new Date(complaint.created_at), { addSuffix: true, locale: dateLocale })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
