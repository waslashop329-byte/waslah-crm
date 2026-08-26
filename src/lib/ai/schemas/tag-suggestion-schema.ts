import { z } from "zod";

// Scope decision: suggestions are restricted to tags already in the system
// (Part 6 option 1 — "suggest an existing approved tag"). The AI is given
// the full current tag list and told it may only choose from it; the "submit
// a brand new tag for admin approval" path (option 2) is not implemented in
// this pass.
export const tagSuggestionsSchema = z.object({
  suggestions: z
    .array(
      z.object({
        tag_name: z.string().min(1).max(60),
        reason: z.string().min(1).max(300),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(5),
});

export type TagSuggestionsOutput = z.infer<typeof tagSuggestionsSchema>;

export const TAG_SUGGESTIONS_SCHEMA_DESCRIPTION = `{
  "suggestions": [
    { "tag_name": string (must be exactly one of the "available_tags" given), "reason": string, "confidence": number 0-1 }
  ]
}`;
