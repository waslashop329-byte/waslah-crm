import type { CustomerAiContext } from "@/lib/ai/context/customer-context-builder";

export function buildCustomerSummaryPrompt(context: CustomerAiContext): { systemPrompt: string; userPrompt: string } {
  const systemPrompt =
    "You write concise, factual customer relationship summaries for a CRM employee. " +
    "Reference the customer's own numbers (order counts, spend, risk category) rather than generic statements. " +
    "If the customer has very little history, say so plainly instead of speculating.";

  const userPrompt = `Customer AI Context:\n${JSON.stringify(context, null, 2)}\n\nGenerate the customer summary now.`;

  return { systemPrompt, userPrompt };
}
