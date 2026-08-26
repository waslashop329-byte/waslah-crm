"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export interface FeedbackActionState {
  error?: string;
  success?: boolean;
}

const feedbackSchema = z.object({
  outputType: z.enum(["customer_summary", "next_best_action", "tag_suggestion", "insight", "assistant_message"]),
  outputId: z.string().min(1),
  rating: z.enum(["helpful", "not_helpful"]),
  feedbackText: z.string().max(1000).optional(),
});

// Part 17 — shared across every feature that shows AI output (summary,
// insights, recommendations, assistant replies), so there's one feedback
// path instead of one per feature.
export async function submitAiFeedbackAction(_prevState: FeedbackActionState, formData: FormData): Promise<FeedbackActionState> {
  const user = await requireUser();

  const parsed = feedbackSchema.safeParse({
    outputType: formData.get("outputType"),
    outputId: formData.get("outputId"),
    rating: formData.get("rating"),
    feedbackText: formData.get("feedbackText") || undefined,
  });
  if (!parsed.success) return { error: "Invalid feedback" };

  const supabase = createAdminClient();
  const { error } = await supabase.from("ai_feedback").insert({
    user_id: user.userId,
    output_type: parsed.data.outputType,
    output_id: parsed.data.outputId,
    rating: parsed.data.rating,
    feedback_text: parsed.data.feedbackText ?? null,
  });

  if (error) return { error: error.message };
  return { success: true };
}
