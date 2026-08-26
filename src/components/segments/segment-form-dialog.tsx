"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SegmentConditionBuilder } from "@/components/segments/segment-condition-builder";
import { createSegmentAction, updateSegmentAction, type SegmentActionState } from "@/app/(dashboard)/segments/actions";
import type { SegmentConditions } from "@/lib/intelligence/segments/segment-schema";
import type { SegmentFieldKey, SegmentOperator } from "@/lib/intelligence/segments/segment-schema";

const initialState: SegmentActionState = {};

interface SegmentFormDialogProps {
  mode: "create" | "edit";
  segmentId?: string;
  initialName?: string;
  initialDescription?: string | null;
  initialConditions?: SegmentConditions | null;
}

export function SegmentFormDialog({ mode, segmentId, initialName, initialDescription, initialConditions }: SegmentFormDialogProps) {
  const t = useTranslations("segments");
  const [open, setOpen] = useState(false);
  const action = mode === "create" ? createSegmentAction : updateSegmentAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  const conditionRows = (initialConditions?.conditions ?? []).map((c) => ({
    field: c.field as SegmentFieldKey,
    operator: c.operator as SegmentOperator,
    value: String(c.value),
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" />
            {t("newSegment")}
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="size-7">
            <Pencil className="size-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? t("createTitle") : t("editTitle")}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {segmentId ? <input type="hidden" name="segmentId" value={segmentId} /> : null}

          <div className="space-y-1.5">
            <Label htmlFor="segment-name">{t("name")}</Label>
            <Input id="segment-name" name="name" defaultValue={initialName} required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="segment-description">{t("description")}</Label>
            <Textarea id="segment-description" name="description" defaultValue={initialDescription ?? ""} rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label>{t("rules")}</Label>
            <SegmentConditionBuilder
              name="conditionsJson"
              initialOperator={initialConditions?.operator ?? "AND"}
              initialConditions={conditionRows}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? t("saving") : mode === "create" ? t("create") : t("saveChanges")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
