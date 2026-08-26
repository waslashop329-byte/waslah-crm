import type { CallAttemptResult } from "@/lib/types/database";

export interface OrderAttemptGroup {
  orderId: string;
  results: CallAttemptResult[];
}

export interface ConfirmationKpis {
  assignedOrders: number;
  contactedOrders: number;
  confirmedOrders: number;
  /** Percentage of assigned orders that got at least one call attempt. */
  contactRate: number | null;
  /** Percentage of contacted orders that ended up confirmed. */
  confirmationRate: number | null;
  averageAttempts: number | null;
}

// Pure — no DB access — so agent KPI math is unit-testable the same way
// score/risk math already is (Phase 4). "Contacted" means at least one call
// attempt exists; "confirmed" means any attempt on that order resulted in
// confirmed (an order can flip through no_answer -> confirmed).
export function calculateConfirmationKpis(assignedOrderIds: string[], attemptsByOrder: OrderAttemptGroup[]): ConfirmationKpis {
  const attemptMap = new Map(attemptsByOrder.map((group) => [group.orderId, group.results]));

  const assignedOrders = assignedOrderIds.length;
  let contactedOrders = 0;
  let confirmedOrders = 0;
  let totalAttempts = 0;

  for (const orderId of assignedOrderIds) {
    const results = attemptMap.get(orderId) ?? [];
    if (results.length > 0) contactedOrders += 1;
    if (results.includes("confirmed")) confirmedOrders += 1;
    totalAttempts += results.length;
  }

  return {
    assignedOrders,
    contactedOrders,
    confirmedOrders,
    contactRate: assignedOrders > 0 ? round1((contactedOrders / assignedOrders) * 100) : null,
    confirmationRate: contactedOrders > 0 ? round1((confirmedOrders / contactedOrders) * 100) : null,
    averageAttempts: assignedOrders > 0 ? round1(totalAttempts / assignedOrders) : null,
  };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
