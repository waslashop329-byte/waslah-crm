"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateInsightsAction, type AiInsightsActionState } from "@/app/(dashboard)/ai-insights/actions";

const initialState: AiInsightsActionState = {};

export function GenerateInsightsButton() {
  const t = useTranslations("aiInsightsPage");
  const [state, formAction, isPending] = useActionState(generateInsightsAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(state.message ?? t("generated"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction}>
      <Button type="submit" disabled={isPending} className="gap-1.5">
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        {isPending ? t("analyzing") : t("generate")}
      </Button>
    </form>
  );
}
