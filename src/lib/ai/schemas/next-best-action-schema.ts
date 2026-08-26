import { z } from "zod";

export const nextBestActionSchema = z.object({
  recommended_action: z.string().min(1).max(200),
  reason: z.string().min(1).max(500),
  priority: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
  suggested_timing: z.string().min(1).max(100),
  // Present only when the recommendation is concretely "create a follow-up" —
  // this is what gets applied via the existing follow-up service on approval.
  proposed_follow_up: z
    .object({
      type: z.enum(["call", "whatsapp", "general"]),
      title: z.string().min(1).max(200),
      days_from_now: z.number().min(0).max(30),
    })
    .nullable(),
});

export type NextBestActionOutput = z.infer<typeof nextBestActionSchema>;

export const NEXT_BEST_ACTION_SCHEMA_DESCRIPTION = `{
  "recommended_action": string (short label, e.g. "Send WhatsApp follow-up"),
  "reason": string (grounded in the specific data provided),
  "priority": "low" | "medium" | "high",
  "confidence": number between 0 and 1,
  "suggested_timing": string (e.g. "within 2 days"),
  "proposed_follow_up": { "type": "call"|"whatsapp"|"general", "title": string, "days_from_now": number } | null
}`;
