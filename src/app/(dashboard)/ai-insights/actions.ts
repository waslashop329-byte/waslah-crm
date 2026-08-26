"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { generateBusinessInsights } from "@/lib/ai/services/business-insights-service";
import { recordAudit } from "@/lib/services/audit-service";

export interface AiInsightsActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

export async function generateInsightsAction(): Promise<AiInsightsActionState> {
  const user = await requirePermission("ai.insights.view");

  try {
    const insights = await generateBusinessInsights(user.userId);

    await recordAudit({
      actorId: user.userId,
      action: "ai_insights.generated",
      entityType: "ai_insights",
      entityId: "batch",
      afterData: { count: insights.length },
    });

    revalidatePath("/ai-insights");
    return { success: true, message: insights.length === 0 ? "No new insights found this time" : `Generated ${insights.length} insights` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to generate insights" };
  }
}
