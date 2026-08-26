"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateComplaintStatusAction, type ComplaintActionState } from "@/app/(dashboard)/complaints/actions";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { ComplaintWithCustomer } from "@/lib/repositories/complaints-repository";

const initialState: ComplaintActionState = {};

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

export function ComplaintsTable({ complaints, canManage }: { complaints: ComplaintWithCustomer[]; canManage: boolean }) {
  const t = useTranslations("complaintsPage");

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.customer")}</TableHead>
            <TableHead>{t("table.type")}</TableHead>
            <TableHead>{t("table.subject")}</TableHead>
            <TableHead>{t("table.status")}</TableHead>
            <TableHead>{t("table.logged")}</TableHead>
            {canManage ? <TableHead className="min-w-64">{t("table.update")}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {complaints.map((complaint) => (
            <ComplaintRow key={complaint.id} complaint={complaint} canManage={canManage} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ComplaintRow({ complaint, canManage }: { complaint: ComplaintWithCustomer; canManage: boolean }) {
  const t = useTranslations("complaintsPage");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateComplaintStatusAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("complaintUpdated"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <TableRow>
      <TableCell className="text-sm">
        <Link href={`/customers/${complaint.customer_id}`} className="hover:underline">
          {complaint.customer_full_name}
        </Link>
      </TableCell>
      <TableCell className="text-sm capitalize text-muted-foreground">{t(TYPE_KEYS[complaint.type] ?? "typeComplaint")}</TableCell>
      <TableCell className="text-sm">{complaint.subject}</TableCell>
      <TableCell>
        <Badge variant="outline" className={`border-transparent ${STATUS_STYLES[complaint.status]}`}>
          {t(STATUS_KEYS[complaint.status])}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(complaint.created_at), { addSuffix: true, locale: dateLocale })}</TableCell>
      {canManage ? (
        <TableCell className="p-2">
          {editing ? (
            <form action={formAction} className="flex flex-col gap-1.5">
              <input type="hidden" name="complaintId" value={complaint.id} />
              <input type="hidden" name="customerId" value={complaint.customer_id} />
              <div className="flex items-center gap-1.5">
                <Select name="status" defaultValue={complaint.status}>
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">{t("statusOpen")}</SelectItem>
                    <SelectItem value="in_progress">{t("statusInProgress")}</SelectItem>
                    <SelectItem value="resolved">{t("statusResolved")}</SelectItem>
                    <SelectItem value="closed">{t("statusClosed")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" size="sm" variant="outline" disabled={isPending} className="h-8 shrink-0">
                  {isPending ? t("saving") : t("save")}
                </Button>
              </div>
              <Textarea name="resolutionNotes" placeholder={t("resolutionNotesPlaceholder")} defaultValue={complaint.resolution_notes ?? ""} rows={1} className="h-8 min-h-8 resize-none py-1.5 text-xs" />
            </form>
          ) : (
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEditing(true)}>
              {t("updateStatus")}
            </Button>
          )}
        </TableCell>
      ) : null}
    </TableRow>
  );
}
