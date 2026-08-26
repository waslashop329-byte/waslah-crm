import { z } from "zod";

// Part 9 explicitly wants fact vs. inference vs. recommendation kept separate
// — three distinct fields, not one blended paragraph, so the UI can label
// each part instead of presenting AI inference as confirmed fact.
export const businessInsightSchema = z.object({
  category: z.enum(["cancellation", "churn", "repeat_purchase", "high_value", "risk_trend", "follow_up_performance", "automation_performance"]),
  title: z.string().min(1).max(150),
  fact_summary: z.string().min(1).max(300),
  inference: z.string().max(400).nullable(),
  recommended_action: z.string().max(300).nullable(),
  priority: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
});

export const businessInsightsSchema = z.object({
  insights: z.array(businessInsightSchema).max(8),
});

export type BusinessInsightOutput = z.infer<typeof businessInsightSchema>;

export const BUSINESS_INSIGHTS_SCHEMA_DESCRIPTION = `{
  "insights": [
    {
      "category": "cancellation"|"churn"|"repeat_purchase"|"high_value"|"risk_trend"|"follow_up_performance"|"automation_performance",
      "title": string,
      "fact_summary": string (an observed fact directly from the metrics given — no speculation),
      "inference": string | null (your interpretation of why the fact matters — clearly distinct from fact_summary),
      "recommended_action": string | null,
      "priority": "low"|"medium"|"high",
      "confidence": number 0-1
    }
  ]
}`;
