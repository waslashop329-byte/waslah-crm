// Phase 14 (Confirmation workflow automation): SLA-breach and escalation
// flags for the mission queue, plus a retry-cadence hint. Pure, unit-verified
// before wiring in, same convention as auto-assignment.ts alongside it.

export type ConfirmationAlert = "escalate" | "overdue" | null;

const OVERDUE_HOURS = 24;
const ESCALATION_ATTEMPT_THRESHOLD = 3;
// Results that mean "we tried and didn't get a definitive answer" — these are
// the attempts that should count toward escalation. confirmed/cancelled are
// terminal outcomes and would already have moved the order out of the queue.
const NON_FINAL_RESULTS = new Set(["no_answer", "reschedule", "invalid_number"]);

export interface CallAttemptLike {
  result: string;
  attempted_at: string;
}

/**
 * Escalation (repeated failed contact) takes priority over "overdue" (no
 * contact attempted at all yet) — an order that's already been tried 3 times
 * without a definitive answer needs a different response than one nobody has
 * called yet.
 */
export function getConfirmationAlert(orderedAt: string, callAttempts: CallAttemptLike[], now: Date = new Date()): ConfirmationAlert {
  const nonFinalCount = callAttempts.filter((a) => NON_FINAL_RESULTS.has(a.result)).length;
  if (nonFinalCount >= ESCALATION_ATTEMPT_THRESHOLD) return "escalate";

  if (callAttempts.length === 0) {
    const hoursSinceOrdered = (now.getTime() - new Date(orderedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceOrdered >= OVERDUE_HOURS) return "overdue";
  }

  return null;
}

/** Hours since the most recent call attempt, or null if there's never been one. Used for a soft retry-cadence hint, never a hard block. */
export function getHoursSinceLastAttempt(callAttempts: CallAttemptLike[], now: Date = new Date()): number | null {
  if (callAttempts.length === 0) return null;
  const mostRecentMs = Math.max(...callAttempts.map((a) => new Date(a.attempted_at).getTime()));
  return (now.getTime() - mostRecentMs) / (1000 * 60 * 60);
}
