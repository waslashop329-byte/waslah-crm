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
import { deleteOfferAction, type PromotionActionState } from "@/app/(dashboard)/promotions/actions";

const initialState: PromotionActionState = {};

export function DeleteOfferButton({ offerId, offerName }: { offerId: string; offerName: string }) {
  const t = useTranslations("promotions");
  const [state, formAction, isPending] = useActionState(deleteOfferAction, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
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
          <AlertDialogTitle>{t("deleteConfirmTitle", { name: offerName })}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteConfirmDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="id" value={offerId} />
            <AlertDialogAction type="submit" disabled={isPending} className="bg-destructive text-white hover:bg-destructive/90">
              {isPending ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
