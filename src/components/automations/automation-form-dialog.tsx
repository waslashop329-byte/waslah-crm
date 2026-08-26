"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SegmentConditionBuilder } from "@/components/segments/segment-condition-builder";
import { ActionBuilder } from "@/components/automations/action-builder";
import { AUTOMATION_TRIGGERS } from "@/lib/intelligence/automation/trigger-schema";
import { createAutomationRuleAction, updateAutomationRuleAction, type AutomationActionState } from "@/app/(dashboard)/automations/actions";
import type { SegmentConditions } from "@/lib/intelligence/segments/segment-schema";
import type { AutomationAction as AutomationActionConfig } from "@/lib/intelligence/automation/action-schema";
import type { TagRow } from "@/lib/types/database";

const initialState: AutomationActionState = {};

interface AutomationFormDialogProps {
  mode: "create" | "edit";
  ruleId?: string;
  initialName?: string;
  initialTrigger?: string;
  initialConditions?: SegmentConditions | null;
  initialActions?: AutomationActionConfig[];
  tags: TagRow[];
  employees: { id: string; full_name: string }[];
}

export function AutomationFormDialog({
  mode,
  ruleId,
  initialName,
  initialTrigger,
  initialConditions,
  initialActions,
  tags,
  employees,
}: AutomationFormDialogProps) {
  const t = useTranslations("automations");
  const [open, setOpen] = useState(false);
  const action = mode === "create" ? createAutomationRuleAction : updateAutomationRuleAction;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  const conditionRows = (initialConditions?.conditions ?? []).map((c) => ({
    field: c.field,
    operator: c.operator,
    value: String(c.value),
  }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" />
            {t("newAutomation")}
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

        <ScrollArea className="max-h-[70vh]">
          <form action={formAction} className="space-y-4 pr-4">
            {ruleId ? <input type="hidden" name="ruleId" value={ruleId} /> : null}

            <div className="space-y-1.5">
              <Label htmlFor="automation-name">{t("name")}</Label>
              <Input id="automation-name" name="name" defaultValue={initialName} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="automation-trigger">{t("triggerWhen")}</Label>
              <Select name="trigger" defaultValue={initialTrigger ?? "order.delivered"}>
                <SelectTrigger id="automation-trigger" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTOMATION_TRIGGERS.map((trigger) => (
                    <SelectItem key={trigger} value={trigger}>
                      {trigger}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("conditionsIf")}</Label>
              <SegmentConditionBuilder
                name="conditionsJson"
                initialOperator={initialConditions?.operator ?? "AND"}
                initialConditions={conditionRows}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("actionsThen")}</Label>
              <ActionBuilder name="actionsJson" tags={tags} employees={employees} initialActions={initialActions} />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? t("saving") : mode === "create" ? t("create") : t("saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
