export interface AgentActivity {
  agentId: string;
  confirmedOrders: number;
  confirmedRevenue: number;
  completedFollowUps: number;
}

export interface AgentPerformance extends AgentActivity {
  xp: number;
  commission: number;
}

export interface PerformanceWeights {
  xpPerConfirmedOrder: number;
  xpPerCompletedFollowup: number;
  commissionRatePercent: number;
}

// Pure — XP and commission are both derived, never stored, so changing the
// weights in Settings re-ranks everyone retroactively rather than only
// affecting activity going forward (there's no historical XP ledger to keep
// in sync). Ranked by confirmed revenue, XP shown alongside as the
// "gamification" number, not the ranking key — revenue is what the business
// actually cares about ordering by.
export function calculateAgentPerformance(activities: AgentActivity[], weights: PerformanceWeights): AgentPerformance[] {
  return activities
    .map((activity) => ({
      ...activity,
      xp: activity.confirmedOrders * weights.xpPerConfirmedOrder + activity.completedFollowUps * weights.xpPerCompletedFollowup,
      commission: Math.round(activity.confirmedRevenue * (weights.commissionRatePercent / 100) * 100) / 100,
    }))
    .sort((a, b) => b.confirmedRevenue - a.confirmedRevenue);
}

export interface GoalProgress {
  targetConfirmedOrders: number;
  targetRevenue: number;
  ordersProgress: number | null;
  revenueProgress: number | null;
}

// Null when no goal is set for that dimension — 0% and "no goal" must never
// look the same on screen.
export function calculateGoalProgress(activity: AgentActivity, targetConfirmedOrders: number, targetRevenue: number): GoalProgress {
  return {
    targetConfirmedOrders,
    targetRevenue,
    ordersProgress: targetConfirmedOrders > 0 ? Math.round((activity.confirmedOrders / targetConfirmedOrders) * 1000) / 10 : null,
    revenueProgress: targetRevenue > 0 ? Math.round((activity.confirmedRevenue / targetRevenue) * 1000) / 10 : null,
  };
}
