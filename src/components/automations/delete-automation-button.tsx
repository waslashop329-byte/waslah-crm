"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteAutomationRuleAction, type AutomationActionState } from "@/app/(dashboard)/automations/actions";

const initialState: AutomationActionState = {};

export function DeleteAutomationButton({ ruleId, ruleName }: { ruleId: string; ruleName: string }) {
  const t = useTranslations("automations");
  const [state, formAction, isPending] = useActionState(deleteAutomationRuleAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(t("deleted"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7">
          <Trash2 className="size-3.5 text-muted-foreground" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("deleteConfirmTitle", { name: ruleName })}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteConfirmDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="ruleId" value={ruleId} />
            <AlertDialogAction type="submit" disabled={isPending} className="bg-destructive text-white hover:bg-destructive/90">
              {isPending ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
