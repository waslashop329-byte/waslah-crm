export interface AcquiredCustomer {
  source: string | null;
  /** ad_cost of that customer's first order — the acquisition-cost proxy. Null if never entered. */
  firstOrderAdCost: number | null;
}

export interface CacBySource {
  source: string;
  customersAcquired: number;
  customersWithKnownCost: number;
  /** Null when no customer in this source has a known first-order ad cost yet. */
  averageCac: number | null;
}

// No real ad-platform spend feed exists yet (Phase 3's integration engine
// only syncs customers/orders) — CAC is approximated per Part 7's spirit as
// the average ad_cost logged on each customer's first order, grouped by the
// manually-tagged acquisition source (customer_acquisition.source). Customers
// with no source tagged are grouped under "untagged" so they're visible
// rather than silently dropped.
export function calculateCacBySource(customers: AcquiredCustomer[]): CacBySource[] {
  const groups = new Map<string, AcquiredCustomer[]>();

  for (const customer of customers) {
    const key = customer.source ?? "untagged";
    const list = groups.get(key) ?? [];
    list.push(customer);
    groups.set(key, list);
  }

  return Array.from(groups.entries())
    .map(([source, group]) => {
      const known = group.filter((c) => c.firstOrderAdCost !== null);
      const averageCac = known.length > 0 ? round2(known.reduce((sum, c) => sum + (c.firstOrderAdCost ?? 0), 0) / known.length) : null;
      return { source, customersAcquired: group.length, customersWithKnownCost: known.length, averageCac };
    })
    .sort((a, b) => b.customersAcquired - a.customersAcquired);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
