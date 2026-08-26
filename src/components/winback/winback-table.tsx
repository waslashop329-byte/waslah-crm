"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendMessageAction } from "@/app/(dashboard)/customers/actions";
import type { ActionState } from "@/app/(dashboard)/customers/actions";
import type { WinbackCandidate } from "@/lib/repositories/winback-repository";

const initialState: ActionState = {};

const STAGE_STYLES: Record<string, string> = {
  "30d": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "60d": "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  "90d": "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  "120d": "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200",
};

export function WinbackTable({ candidates }: { candidates: WinbackCandidate[] }) {
  const t = useTranslations("winBack");

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.customer")}</TableHead>
            <TableHead>{t("table.stage")}</TableHead>
            <TableHead>{t("table.lastOrder")}</TableHead>
            <TableHead className="min-w-72">{t("table.message")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => (
            <CandidateRow key={candidate.customerId} candidate={candidate} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CandidateRow({ candidate }: { candidate: WinbackCandidate }) {
  const t = useTranslations("winBack");
  const locale = useLocale();
  const [state, formAction, isPending] = useActionState(sendMessageAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("messageSent"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const defaultBody = t(`templates.${candidate.stage}`, { name: candidate.fullName });

  return (
    <TableRow>
      <TableCell className="text-sm">{candidate.fullName}</TableCell>
      <TableCell>
        <Badge variant="outline" className={`border-transparent ${STAGE_STYLES[candidate.stage]}`}>
          {t("daysInactive", { stage: candidate.stage, days: candidate.daysSinceLastOrder })}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{new Date(candidate.lastOrderAt).toLocaleDateString(locale)}</TableCell>
      <TableCell className="p-2">
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="customerId" value={candidate.customerId} />
          <input type="hidden" name="channel" value="whatsapp" />
          <Textarea name="body" defaultValue={defaultBody} rows={1} className="h-8 min-h-8 w-72 resize-none py-1.5 text-xs" />
          <Button type="submit" size="sm" variant="outline" disabled={isPending} className="h-8 shrink-0">
            {isPending ? t("sending") : t("send")}
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}
