"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { explainRiskAction, type RiskExplanationState } from "@/app/(dashboard)/customers/[customerId]/ai-actions";

const initialState: RiskExplanationState = {};

export function RiskExplanationButton({ customerId }: { customerId: string }) {
  const t = useTranslations("customerProfile.risk");
  const [state, formAction, isPending] = useActionState(explainRiskAction, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="customerId" value={customerId} />
        <Button type="submit" variant="ghost" size="sm" disabled={isPending} className="gap-1.5 text-xs">
          {isPending ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
          {t("explainWithAi")}
        </Button>
      </form>

      {state.result ? (
        <div className="rounded-md bg-muted p-2.5 text-xs">
          <p>{state.result.explanation}</p>
          {state.result.supporting_factors.length > 0 ? (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-muted-foreground">
              {state.result.supporting_factors.map((factor, i) => (
                <li key={i}>{factor}</li>
              ))}
            </ul>
          ) : null}
          {state.result.recent_changes ? <p className="mt-1.5 text-muted-foreground">{state.result.recent_changes}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
