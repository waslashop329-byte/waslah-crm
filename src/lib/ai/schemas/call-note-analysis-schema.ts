import { z } from "zod";

export const callNoteAnalysisSchema = z.object({
  quality_score: z.number().min(0).max(100),
  attempted_upsell: z.boolean(),
  customer_objection: z.string().max(300).nullable(),
  improvement_suggestion: z.string().max(300).nullable(),
});

export type CallNoteAnalysisOutput = z.infer<typeof callNoteAnalysisSchema>;

export const CALL_NOTE_ANALYSIS_SCHEMA_DESCRIPTION = `{
  "quality_score": number 0-100 (how well-handled the call sounds based only on the notes given — grounded in what's actually written, not assumed),
  "attempted_upsell": boolean (does the note mention any upsell/cross-sell attempt?),
  "customer_objection": string | null (the customer's stated objection/reason, if the note mentions one, else null),
  "improvement_suggestion": string | null (one concrete thing the agent could have done differently, or null if nothing stands out)
}`;
