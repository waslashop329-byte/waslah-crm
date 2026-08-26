import { z } from "zod";

export const customerSummarySchema = z.object({
  summary: z.string().min(1).max(600),
  key_points: z.array(z.string().max(200)).max(6),
  concerns: z.array(z.string().max(200)).max(6),
  recommended_action: z.string().max(300).nullable(),
});

export type CustomerSummaryOutput = z.infer<typeof customerSummarySchema>;

export const CUSTOMER_SUMMARY_SCHEMA_DESCRIPTION = `{
  "summary": string (2-4 sentences, concise overview),
  "key_points": string[] (notable factual characteristics, e.g. "Repeat customer with 8 orders"),
  "concerns": string[] (specific risks or issues grounded in the data — empty array if none),
  "recommended_action": string | null (one concrete next step, or null if nothing is needed)
}`;
