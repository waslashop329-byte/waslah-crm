"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitAiFeedbackAction, type FeedbackActionState } from "@/app/(dashboard)/ai-feedback-actions";

const initialState: FeedbackActionState = {};

interface FeedbackButtonsProps {
  outputType: "customer_summary" | "next_best_action" | "tag_suggestion" | "insight" | "assistant_message";
  outputId: string;
}

export function FeedbackButtons({ outputType, outputId }: FeedbackButtonsProps) {
  const t = useTranslations("customerProfile.feedback");
  const [state, formAction, isPending] = useActionState(submitAiFeedbackAction, initialState);
  const [rated, setRated] = useState<"helpful" | "not_helpful" | null>(null);

  useEffect(() => {
    if (state.success) toast.success(t("thanks"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (rated) {
    return <p className="text-xs text-muted-foreground">{t("thanks")}</p>;
  }

  return (
    <div className="flex items-center gap-1">
      <form
        action={(fd) => {
          setRated("helpful");
          formAction(fd);
        }}
      >
        <input type="hidden" name="outputType" value={outputType} />
        <input type="hidden" name="outputId" value={outputId} />
        <input type="hidden" name="rating" value="helpful" />
        <Button type="submit" variant="ghost" size="icon" className="size-6" disabled={isPending}>
          <ThumbsUp className="size-3" />
        </Button>
      </form>
      <form
        action={(fd) => {
          setRated("not_helpful");
          formAction(fd);
        }}
      >
        <input type="hidden" name="outputType" value={outputType} />
        <input type="hidden" name="outputId" value={outputId} />
        <input type="hidden" name="rating" value="not_helpful" />
        <Button type="submit" variant="ghost" size="icon" className="size-6" disabled={isPending}>
          <ThumbsDown className="size-3" />
        </Button>
      </form>
    </div>
  );
}
