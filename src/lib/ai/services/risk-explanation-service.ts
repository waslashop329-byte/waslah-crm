import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAiProvider } from "@/lib/ai/providers/registry";
import { generateStructuredOutput } from "@/lib/ai/services/structured-output-service";
import { logAiUsage } from "@/lib/ai/services/usage-service";
import { riskExplanationSchema, RISK_EXPLANATION_SCHEMA_DESCRIPTION } from "@/lib/ai/schemas/risk-explanation-schema";
import type { RiskExplanationOutput } from "@/lib/ai/schemas/risk-explanation-schema";

// Part 7: AI explains the existing rule-based risk calculation in words — it
// never recomputes or overrides it. Generated on demand (not stored/cached
// as its own table): it's cheap, and it's just a narration of numbers that
// are themselves already fresh (risk-service.ts recalculates on every
// relevant order event).
export async function explainCustomerRisk(customerId: string, userId: string | null): Promise<RiskExplanationOutput> {
  const supabase = createAdminClient();

  const [{ data: customer }, { data: risk }, { data: orders }] = await Promise.all([
    supabase.from("customers").select("full_name, total_orders, cancelled_orders, delivered_orders, returned_orders").eq("id", customerId).single(),
    supabase.from("customer_risk_profiles").select("*").eq("customer_id", customerId).maybeSingle(),
    supabase.from("orders").select("status, ordered_at").eq("customer_id", customerId).order("ordered_at", { ascending: false }).limit(10),
  ]);

  if (!customer) throw new Error("Customer not found");
  if (!risk) throw new Error("Risk has not been calculated for this customer yet");

  const context = {
    customer: { name: customer.full_name, total_orders: customer.total_orders, cancelled_orders: customer.cancelled_orders, delivered_orders: customer.delivered_orders, returned_orders: customer.returned_orders },
    risk: {
      cancellation_risk_percent: risk.cancellation_risk,
      delivery_risk_percent: risk.delivery_risk,
      return_risk_percent: risk.return_risk,
      overall_risk_percent: risk.overall_risk,
      overall_category: risk.overall_risk_category,
    },
    recent_orders: (orders ?? []).map((order) => ({ status: order.status, ordered_at: order.ordered_at })),
  };

  const provider = getAiProvider();
  const startedAt = Date.now();

  const systemPrompt =
    "You explain an already-computed, rule-based customer risk score in plain language. " +
    "You must reference the exact numbers given (counts, percentages) — never invent a statistic that isn't in the data.";
  const userPrompt = `Risk data:\n${JSON.stringify(context, null, 2)}\n\nExplain this risk assessment now.`;

  try {
    const result = await generateStructuredOutput(provider, {
      systemPrompt,
      userPrompt,
      schema: riskExplanationSchema,
      schemaDescription: RISK_EXPLANATION_SCHEMA_DESCRIPTION,
    });

    await logAiUsage({
      userId,
      feature: "risk_explanation",
      entityType: "customer",
      entityId: customerId,
      provider: provider.name,
      model: provider.model,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      status: "success",
    });

    return result.data;
  } catch (error) {
    await logAiUsage({
      userId,
      feature: "risk_explanation",
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
