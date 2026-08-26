export interface CancellationReasonBreakdown {
  reasonCategory: string;
  count: number;
  percentage: number;
}

// Pure — Part 12's "32% of Cancelled Orders — reason: price" table. Attempts
// with no reason logged are grouped under "unspecified" so they're visible
// in the denominator rather than silently excluded (which would inflate
// every real category's percentage).
export function calculateReasonBreakdown(reasons: (string | null)[]): CancellationReasonBreakdown[] {
  if (reasons.length === 0) return [];

  const counts = new Map<string, number>();
  for (const reason of reasons) {
    const key = reason ?? "unspecified";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([reasonCategory, count]) => ({ reasonCategory, count, percentage: Math.round((count / reasons.length) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count);
}
