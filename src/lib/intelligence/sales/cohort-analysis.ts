export interface CohortCustomer {
  customerSince: string;
  orderDates: string[];
}

export interface CohortRow {
  cohortMonth: string; // "2026-01"
  customersInCohort: number;
  retention: Partial<Record<number, number | null>>; // window days -> % with a repeat order by then, null if window hasn't elapsed yet
}

// Pure — Part 14's cohort table: acquired-in-month X, what % ordered again
// within N days. A window's % is null (not 0) for a cohort too young for
// that window to have elapsed yet, since "0% retained" and "too early to
// tell" are different facts and must never be conflated.
export function calculateCohortRetention(customers: CohortCustomer[], windows: number[] = [30, 60, 90, 180], now: Date = new Date()): CohortRow[] {
  const cohorts = new Map<string, CohortCustomer[]>();

  for (const customer of customers) {
    const month = customer.customerSince.slice(0, 7);
    const list = cohorts.get(month) ?? [];
    list.push(customer);
    cohorts.set(month, list);
  }

  return Array.from(cohorts.entries())
    .map(([cohortMonth, cohortCustomers]) => {
      const retention: Partial<Record<number, number | null>> = {};

      for (const windowDays of windows) {
        const eligible = cohortCustomers.filter((c) => now.getTime() - new Date(c.customerSince).getTime() >= windowDays * 24 * 60 * 60 * 1000);
        if (eligible.length === 0) {
          retention[windowDays] = null;
          continue;
        }

        const retained = eligible.filter((c) => {
          const cutoff = new Date(c.customerSince).getTime() + windowDays * 24 * 60 * 60 * 1000;
          return c.orderDates.some((d) => {
            const t = new Date(d).getTime();
            return t > new Date(c.customerSince).getTime() && t <= cutoff;
          });
        });

        retention[windowDays] = Math.round((retained.length / eligible.length) * 1000) / 10;
      }

      return { cohortMonth, customersInCohort: cohortCustomers.length, retention };
    })
    .sort((a, b) => b.cohortMonth.localeCompare(a.cohortMonth));
}
