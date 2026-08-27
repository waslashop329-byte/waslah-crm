// Phase 16 (growth roadmap): pure scheduling/exit logic for multi-step
// automated campaigns, unit-verified before wiring into campaign-service.ts,
// same convention as every other calculation module in lib/intelligence/.

export interface CampaignStepLike {
  stepOrder: number;
  delayDays: number;
}

/**
 * When should the step at `stepIndex` (0-based, into steps sorted by
 * stepOrder) go out, relative to when the customer enrolled? Returns null if
 * there's no step at that index (the sequence has run out).
 */
export function computeNextSendAt(enrolledAt: Date, steps: CampaignStepLike[], stepIndex: number): Date | null {
  const sorted = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const step = sorted[stepIndex];
  if (!step) return null;
  return new Date(enrolledAt.getTime() + step.delayDays * 24 * 60 * 60 * 1000);
}

/**
 * A post-purchase sequence exists to nudge a second order; a win-back
 * sequence exists to revive a lapsed one. Either way, if the customer placed
 * a new order after enrolling, the sequence already got what it wanted —
 * further scheduled steps would just be noise, so it exits early rather than
 * running to completion.
 */
export function shouldExitEarly(enrolledAt: string, lastOrderAt: string | null): boolean {
  if (!lastOrderAt) return false;
  return new Date(lastOrderAt).getTime() > new Date(enrolledAt).getTime();
}
