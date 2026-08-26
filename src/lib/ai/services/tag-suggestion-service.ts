import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAiProvider } from "@/lib/ai/providers/registry";
import { generateStructuredOutput } from "@/lib/ai/services/structured-output-service";
import { logAiUsage } from "@/lib/ai/services/usage-service";
import { buildCustomerAiContext } from "@/lib/ai/context/customer-context-builder";
import { tagSuggestionsSchema, TAG_SUGGESTIONS_SCHEMA_DESCRIPTION } from "@/lib/ai/schemas/tag-suggestion-schema";
import type { AiSuggestionRow } from "@/lib/types/database";

export async function generateTagSuggestions(customerId: string, userId: string | null): Promise<AiSuggestionRow[]> {
  const supabase = createAdminClient();
  const context = await buildCustomerAiContext(customerId);
  if (!context) throw new Error("Customer not found");

  const { data: allTags } = await supabase.from("tags").select("id, name").order("name");
  const availableTagNames = (allTags ?? []).map((tag) => tag.name);
  const tagIdByName = new Map((allTags ?? []).map((tag) => [tag.name, tag.id]));

  const provider = getAiProvider();
  const startedAt = Date.now();

  const systemPrompt =
    "You suggest which of the CRM's existing tags apply to this customer, grounded only in the data given. " +
    `You may ONLY choose tag_name values from this exact list: ${availableTagNames.join(", ")}. ` +
    "Do not suggest a tag the customer already has (see customer.tags in the context). Return an empty suggestions array if none apply.";
  const userPrompt = `Customer AI Context:\n${JSON.stringify(context, null, 2)}\n\nSuggest applicable tags now.`;

  try {
    const result = await generateStructuredOutput(provider, {
      systemPrompt,
      userPrompt,
      schema: tagSuggestionsSchema,
      schemaDescription: TAG_SUGGESTIONS_SCHEMA_DESCRIPTION,
    });

    const usageLog = await logAiUsage({
      userId,
      feature: "tag_suggestion",
      entityType: "customer",
      entityId: customerId,
      provider: provider.name,
      model: provider.model,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      status: "success",
    });

    // Guardrail: silently drop any tag name the model invented outside the
    // whitelist we gave it, rather than trusting free text as a tag id.
    const validSuggestions = result.data.suggestions.filter(
      (suggestion) => tagIdByName.has(suggestion.tag_name) && !context.tags.includes(suggestion.tag_name),
    );

    if (validSuggestions.length === 0) return [];

    const { data: inserted, error } = await supabase
      .from("ai_suggestions")
      .insert(
        validSuggestions.map((suggestion) => ({
          type: "tag_suggestion" as const,
          customer_id: customerId,
          proposed_action: { type: "add_tag", tagId: tagIdByName.get(suggestion.tag_name) },
          reason: suggestion.reason,
          confidence: suggestion.confidence,
          status: "pending" as const,
          usage_log_id: usageLog?.id ?? null,
        })),
      )
      .select();

    if (error) throw new Error(error.message);
    return inserted ?? [];
  } catch (error) {
    await logAiUsage({
      userId,
      feature: "tag_suggestion",
      entityType: "customer",
      entityId: customerId,
      provider: provider.name,
      model: provider.model,
      usage: { inputTokens: null, outputTokens: null },
      durationMs: Date.now() - startedAt,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
