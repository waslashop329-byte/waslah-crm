export interface CallNoteContext {
  result: string;
  notes: string;
  reasonCategory: string | null;
  orderStatus: string;
  orderTotal: number;
}

// No audio/transcript exists — this is deliberately scoped to what the agent
// actually typed, and the guardrail instruction (prepended by
// structured-output-service) already forbids inventing anything beyond it.
export function buildCallNoteAnalysisPrompt(context: CallNoteContext): { systemPrompt: string; userPrompt: string } {
  const systemPrompt =
    "You review a confirmation agent's own written notes about a customer call for a CRM manager. " +
    "You were NOT given a recording or transcript — only the agent's note — so never claim to know anything about tone of voice, " +
    "what was literally said, or the call's length. Base every field strictly on the text provided.";

  const userPrompt = `Call attempt:\n${JSON.stringify(context, null, 2)}\n\nAnalyze this call note now.`;

  return { systemPrompt, userPrompt };
}
