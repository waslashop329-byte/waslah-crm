import { z } from "zod";

export const riskExplanationSchema = z.object({
  explanation: z.string().min(1).max(600),
  supporting_factors: z.array(z.string().max(200)).max(6),
  recent_changes: z.string().max(300).nullable(),
});

export type RiskExplanationOutput = z.infer<typeof riskExplanationSchema>;

export const RISK_EXPLANATION_SCHEMA_DESCRIPTION = `{
  "explanation": string (natural-language explanation referencing actual numbers, e.g. "3 of 5 shipped orders failed delivery"),
  "supporting_factors": string[] (specific metrics that drove the risk level),
  "recent_changes": string | null (notable recent change in risk, or null)
}`;
