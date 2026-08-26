export type WinbackStage = "30d" | "60d" | "90d" | "120d";

export const WINBACK_STAGE_THRESHOLDS: { stage: WinbackStage; minDays: number }[] = [
  { stage: "120d", minDays: 120 },
  { stage: "90d", minDays: 90 },
  { stage: "60d", minDays: 60 },
  { stage: "30d", minDays: 30 },
];

// Pure — Part 6's staged win-back (30/60/90/120 days). Null in, null out: no
// last-order date at all means never purchased, not "infinitely inactive" —
// that's a different problem (never-converted, not churned) this function
// deliberately doesn't classify.
export function calculateWinbackStage(daysSinceLastOrder: number | null): WinbackStage | null {
  if (daysSinceLastOrder === null) return null;
  const match = WINBACK_STAGE_THRESHOLDS.find((t) => daysSinceLastOrder >= t.minDays);
  return match?.stage ?? null;
}
