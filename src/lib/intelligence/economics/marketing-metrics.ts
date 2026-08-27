// Phase 15 (growth roadmap): the marketing formulas from the roadmap doc that
// weren't already covered by earlier phases — AOV and realized LTV already
// exist (dashboard KPI + customer profile respectively). Every ratio here
// returns null (never 0 or a divide-by-zero artifact) when there isn't
// enough data to compute it honestly, same convention as the rest of
// lib/intelligence/economics/.

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface RepeatPurchaseInput {
  totalCustomers: number;
  /** Customers with 2 or more total orders. */
  repeatCustomers: number;
}

/** % of the customer base that has ordered more than once. */
export function calculateRepeatPurchaseRate({ totalCustomers, repeatCustomers }: RepeatPurchaseInput): number | null {
  if (totalCustomers === 0) return null;
  return round2((repeatCustomers / totalCustomers) * 100);
}

export interface RetentionInput {
  /** Customers who already existed before the window started. */
  customersExistingBeforeWindow: number;
  /** Of those, how many placed at least one order during the window. */
  ofThoseWhoOrderedInWindow: number;
}

/**
 * Retention Rate = % of the pre-existing customer base that actually
 * transacted again during the window — a behavioral definition (did they
 * order?) rather than a record-existence one (is the row still there?),
 * since a customer record never gets deleted just for going quiet.
 */
export function calculateRetentionRate({ customersExistingBeforeWindow, ofThoseWhoOrderedInWindow }: RetentionInput): number | null {
  if (customersExistingBeforeWindow === 0) return null;
  return round2((ofThoseWhoOrderedInWindow / customersExistingBeforeWindow) * 100);
}

export function calculateChurnRate(retentionRate: number | null): number | null {
  if (retentionRate === null) return null;
  return round2(100 - retentionRate);
}

export interface CacSourceForBlend {
  averageCac: number | null;
  customersWithKnownCost: number;
}

/** Weighted average CAC across every acquisition source with a known cost — feeds the LTV:CAC ratio below. */
export function calculateBlendedCac(sources: CacSourceForBlend[]): number | null {
  const known = sources.filter((s) => s.averageCac !== null && s.customersWithKnownCost > 0);
  const totalCustomers = known.reduce((sum, s) => sum + s.customersWithKnownCost, 0);
  if (totalCustomers === 0) return null;
  const weightedSum = known.reduce((sum, s) => sum + s.averageCac! * s.customersWithKnownCost, 0);
  return round2(weightedSum / totalCustomers);
}

/**
 * LTV:CAC ratio — the industry rule of thumb is 3:1 or higher is healthy.
 * Both sides can be null (no cost data, or no customers yet); the ratio is
 * null whenever either side is, rather than pretending a 0 CAC is "free."
 */
export function calculateLtvToCacRatio(avgLtv: number | null, avgCac: number | null): number | null {
  if (avgLtv === null || avgCac === null || avgCac === 0) return null;
  return round2(avgLtv / avgCac);
}
