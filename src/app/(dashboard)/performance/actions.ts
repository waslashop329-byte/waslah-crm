"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { upsertAgentGoal } from "@/lib/services/performance-service";

export interface PerformanceActionState {
  error?: string;
  success?: boolean;
}

const goalSchema = z.object({
  agentId: z.string().uuid(),
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/, "Invalid period"),
  targetConfirmedOrders: z.coerce.number().min(0),
  targetRevenue: z.coerce.number().min(0),
});

export async function setAgentGoalAction(_prevState: PerformanceActionState, formData: FormData): Promise<PerformanceActionState> {
  const user = await requirePermission("performance.manage");

  const parsed = goalSchema.safeParse({
    agentId: formData.get("agentId"),
    periodMonth: formData.get("periodMonth"),
    targetConfirmedOrders: formData.get("targetConfirmedOrders"),
    targetRevenue: formData.get("targetRevenue"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await upsertAgentGoal(user.userId, parsed.data.agentId, parsed.data.periodMonth, parsed.data.targetConfirmedOrders, parsed.data.targetRevenue);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save goal" };
  }

  revalidatePath("/performance");
  return { success: true };
}
