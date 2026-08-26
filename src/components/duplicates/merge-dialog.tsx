"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ArrowRight, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { mergeCustomersAction, type DuplicateActionState } from "@/app/(dashboard)/duplicates/actions";

const initialState: DuplicateActionState = {};

interface MergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  customerA: { id: string; full_name: string; email: string | null };
  customerB: { id: string; full_name: string; email: string | null };
}

const MOVED_ITEM_KEYS = [
  "movedOrders",
  "movedPhones",
  "movedAddresses",
  "movedNotes",
  "movedTimeline",
  "movedFollowUps",
  "movedTags",
  "movedExternalIds",
  "movedScoreHistory",
];

export function MergeDialog({ open, onOpenChange, candidateId, customerA, customerB }: MergeDialogProps) {
  const t = useTranslations("duplicates.mergeDialog");
  const [primaryId, setPrimaryId] = useState(customerA.id);
  const [state, formAction, isPending] = useActionState(mergeCustomersAction, initialState);

  useEffect(() => {
    if (state.success) {
      toast.success(state.message ?? t("mergedSuccess"));
      onOpenChange(false);
    }
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const secondaryId = primaryId === customerA.id ? customerB.id : customerA.id;
  const primaryCustomer = primaryId === customerA.id ? customerA : customerB;
  const secondaryCustomer = primaryId === customerA.id ? customerB : customerA;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="size-4" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground">{t("keepAsPrimary")}</Label>
          <RadioGroup value={primaryId} onValueChange={setPrimaryId} className="space-y-2">
            {[customerA, customerB].map((customer) => (
              <label
                key={customer.id}
                className="flex items-center gap-2.5 rounded-md border p-2.5 text-sm has-[[data-checked]]:border-primary"
              >
                <RadioGroupItem value={customer.id} />
                <div>
                  <p className="font-medium">{customer.full_name}</p>
                  {customer.email ? <p className="text-xs text-muted-foreground">{customer.email}</p> : null}
                </div>
              </label>
            ))}
          </RadioGroup>

          <div className="flex items-center gap-2 rounded-md bg-muted p-2.5 text-sm">
            <span className="font-medium">{secondaryCustomer.full_name}</span>
            <ArrowRight className="size-3.5 text-muted-foreground rtl:rotate-180" />
            <span className="font-medium">{primaryCustomer.full_name}</span>
          </div>

          <div className="rounded-md border p-3 text-sm">
            <p className="mb-1.5 font-medium">{t("whatWillHappen")}</p>
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
              {MOVED_ITEM_KEYS.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("mergedNote", { secondary: secondaryCustomer.full_name, primary: primaryCustomer.full_name, mergedWord: t("mergedWord") })}
            </p>
          </div>
        </div>

        <form action={formAction}>
          <input type="hidden" name="primaryId" value={primaryId} />
          <input type="hidden" name="secondaryId" value={secondaryId} />
          <input type="hidden" name="candidateId" value={candidateId} />
          <DialogFooter>
            <Button type="submit" disabled={isPending} className="gap-1.5">
              <GitMerge className="size-3.5" />
              {isPending ? t("merging") : t("mergeButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
