export type JourneyStageKey = "first_order" | "confirmed" | "delivered" | "second_order" | "vip";

export interface JourneyStage {
  key: JourneyStageKey;
  completedAt: string | null;
}

export interface JourneyInput {
  firstOrderAt: string | null;
  firstConfirmedAt: string | null;
  firstDeliveredAt: string | null;
  secondOrderAt: string | null;
  vipTaggedAt: string | null;
}

// Pure — a fixed 5-stage funnel (Part 5's Ad→Order→Confirmation→...→VIP,
// trimmed to the stages this CRM actually has dates for; there's no ad-click
// or landing-page event stream to build "First Visit" from). Each stage's
// `completedAt` is null until reached — never inferred or backfilled.
export function calculateJourneyStages(input: JourneyInput): JourneyStage[] {
  return [
    { key: "first_order", completedAt: input.firstOrderAt },
    { key: "confirmed", completedAt: input.firstConfirmedAt },
    { key: "delivered", completedAt: input.firstDeliveredAt },
    { key: "second_order", completedAt: input.secondOrderAt },
    { key: "vip", completedAt: input.vipTaggedAt },
  ];
}
