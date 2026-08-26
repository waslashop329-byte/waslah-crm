"use client";

import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { toggleAutomationRuleAction, type AutomationActionState } from "@/app/(dashboard)/automations/actions";

const initialState: AutomationActionState = {};

export function ToggleAutomationSwitch({ ruleId, isActive }: { ruleId: string; isActive: boolean }) {
  const [state, formAction] = useActionState(toggleAutomationRuleAction, initialState);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  function handleChange() {
    const formData = new FormData();
    formData.set("ruleId", ruleId);
    formData.set("isActive", String(isActive));
    startTransition(() => formAction(formData));
  }

  return <Switch checked={isActive} disabled={isPending} onCheckedChange={handleChange} />;
}
