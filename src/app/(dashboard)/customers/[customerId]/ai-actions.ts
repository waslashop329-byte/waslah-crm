"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { getOrGenerateCustomerSummary } from "@/lib/ai/services/customer-summary-service";
import { generateNextBestAction } from "@/lib/ai/services/next-best-action-service";
import { generateTagSuggestions } from "@/lib/ai/services/tag-suggestion-service";
import { explainCustomerRisk } from "@/lib/ai/services/risk-explanation-service";
import { approveSuggestion, rejectSuggestion } from "@/lib/ai/services/suggestion-approval-service";
import type { RiskExplanationOutput } from "@/lib/ai/schemas/risk-explanation-schema";

export interface AiActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

export interface RiskExplanationState extends AiActionState {
  result?: RiskExplanationOutput;
}

const customerIdSchema = z.object({ customerId: z.string().uuid() });
const suggestionIdSchema = z.object({ suggestionId: z.string().uuid() });

export async function generateSummaryAction(_prevState: AiActionState, formData: FormData): Promise<AiActionState> {
  const user = await requirePermission("ai.summary.generate");
  const parsed = customerIdSchema.safeParse({ customerId: formData.get("customerId") });
  if (!parsed.success) return { error: "Invalid customer" };

  try {
    await getOrGenerateCustomerSummary(parsed.data.customerId, user.userId, true);
    revalidatePath(`/customers/${parsed.data.customerId}`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to generate summary" };
  }
}

export async function generateNextBestActionAction(_prevState: AiActionState, formData: FormData): Promise<AiActionState> {
  const user = await requirePermission("ai.summary.generate");
  const parsed = customerIdSchema.safeParse({ customerId: formData.get("customerId") });
  if (!parsed.success) return { error: "Invalid customer" };

  try {
    await generateNextBestAction(parsed.data.customerId, user.userId);
    revalidatePath(`/customers/${parsed.data.customerId}`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to generate recommendation" };
  }
}

export async function generateTagSuggestionsAction(_prevState: AiActionState, formData: FormData): Promise<AiActionState> {
  const user = await requirePermission("ai.summary.generate");
  const parsed = customerIdSchema.safeParse({ customerId: formData.get("customerId") });
  if (!parsed.success) return { error: "Invalid customer" };

  try {
    const suggestions = await generateTagSuggestions(parsed.data.customerId, user.userId);
    revalidatePath(`/customers/${parsed.data.customerId}`);
    return { success: true, message: suggestions.length === 0 ? "No new tags to suggest" : undefined };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to generate tag suggestions" };
  }
}

export async function explainRiskAction(_prevState: RiskExplanationState, formData: FormData): Promise<RiskExplanationState> {
  const user = await requirePermission("ai.summary.view");
  const parsed = customerIdSchema.safeParse({ customerId: formData.get("customerId") });
  if (!parsed.success) return { error: "Invalid customer" };

  try {
    const result = await explainCustomerRisk(parsed.data.customerId, user.userId);
    return { success: true, result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to explain risk" };
  }
}

export async function approveSuggestionAction(_prevState: AiActionState, formData: FormData): Promise<AiActionState> {
  const user = await requirePermission("ai.suggestions.approve");
  const parsed = suggestionIdSchema.safeParse({ suggestionId: formData.get("suggestionId") });
  if (!parsed.success) return { error: "Invalid suggestion" };

  try {
    const result = await approveSuggestion(parsed.data.suggestionId, user.userId);
    if (result.customer_id) revalidatePath(`/customers/${result.customer_id}`);
    return result.status === "failed" ? { error: result.error ?? "Failed to apply suggestion" } : { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to approve suggestion" };
  }
}

export async function rejectSuggestionAction(_prevState: AiActionState, formData: FormData): Promise<AiActionState> {
  const user = await requirePermission("ai.suggestions.approve");
  const parsed = suggestionIdSchema.safeParse({ suggestionId: formData.get("suggestionId") });
  if (!parsed.success) return { error: "Invalid suggestion" };

  try {
    const result = await rejectSuggestion(parsed.data.suggestionId, user.userId);
    if (result.customer_id) revalidatePath(`/customers/${result.customer_id}`);
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to reject suggestion" };
  }
}
