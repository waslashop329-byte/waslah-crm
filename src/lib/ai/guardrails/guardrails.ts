// Most guardrails in this codebase are architectural, not runtime checks:
// the AI never receives a DB connection or API keys (Part 1's provider
// abstraction is server-only), never executes a CRM-changing action itself
// (Part 13's approval workflow always sits between an AI suggestion and any
// real service call), and every context builder (lib/ai/context/*) only ever
// sends the specific fields a feature needs — never a raw table dump. This
// file covers the parts that genuinely need a runtime check.

// Prepended to every system prompt (Part 3/14): the single instruction that
// keeps every feature grounded and honest about missing data.
export const GROUNDING_INSTRUCTION = [
  "You are an analysis assistant for a CRM. You may ONLY use the facts given to you in the data below.",
  "Never invent, assume, or infer customer history that isn't explicitly present in the provided data.",
  "If the data needed to answer is missing or insufficient, say so explicitly instead of guessing.",
  "You are not able to change any data yourself — you can only describe, explain, and suggest.",
].join(" ");

const SECRET_LIKE_PATTERN = /\b(sk-[a-zA-Z0-9]{16,}|Bearer\s+[a-zA-Z0-9._-]{16,}|AKIA[0-9A-Z]{12,})\b/g;

// Defense-in-depth: strips anything that looks like a credential before an
// AI response is ever stored or shown, in case a prompt injection attempt
// tricked the model into echoing something secret-shaped back.
export function redactSecrets(text: string): string {
  return text.replace(SECRET_LIKE_PATTERN, "[redacted]");
}

// AI Assistant tool inputs (Part 11/12) go through this before the actual
// tool runs — even though every tool also does its own Zod validation, this
// is the one central place that guarantees no tool call is ever skipped.
export function assertToolNameIsRegistered(name: string, registeredNames: readonly string[]): void {
  if (!registeredNames.includes(name)) {
    throw new Error(`AI requested unknown tool "${name}" — refusing to execute it.`);
  }
}
