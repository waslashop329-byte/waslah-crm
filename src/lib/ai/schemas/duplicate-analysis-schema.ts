import { z } from "zod";

export const duplicateAnalysisSchema = z.object({
  recommendation: z.enum(["merge", "review", "keep_separate"]),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string().max(200)).min(1).max(6),
});

export type DuplicateAnalysisOutput = z.infer<typeof duplicateAnalysisSchema>;

export const DUPLICATE_ANALYSIS_SCHEMA_DESCRIPTION = `{
  "recommendation": "merge" | "review" | "keep_separate",
  "confidence": number between 0 and 1,
  "reasons": string[] (specific, grounded in the two customers' data provided)
}`;
