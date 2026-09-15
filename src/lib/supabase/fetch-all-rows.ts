// Supabase/PostgREST hard-caps any row-returning query at 1000 rows on this
// project (confirmed directly: even an explicit .range(0, 1999) still only
// returns 1000) — .limit() can request *less* than the cap but never more.
// Found live: the very first real-data sync (1817 real customers) silently
// undercounted in several business-wide queries (CAC table, avg LTV, cohort
// analysis, the daily maintenance cron's score recalc) because none of them
// paginated past the cap.
//
// Any query expected to return more than ~1000 rows — which now includes
// "every active customer" or "every order in a period" now that real
// production data exists — must page through with this helper instead of a
// bare .select(). Queries that use { count: "exact", head: true } (no rows
// returned, just a count) are NOT affected and don't need this.
export async function fetchAllRows<T>(
  queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const results: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await queryPage(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    results.push(...data);
    if (data.length < pageSize) break; // last page
    offset += pageSize;
  }

  return results;
}

// A `{ count: "exact", head: true }` query that errors (e.g. a statement
// timeout under real concurrent load — found live on the dashboard at
// ~11,000 customers) reads as `count: null` from a bare `.count ?? 0`, with
// zero visibility that anything went wrong: a real failure looks exactly
// like a legitimate zero. Every count query across the dashboard/reporting
// repositories should go through this instead, so a real error gets logged
// (visible in server logs) rather than silently disappearing into a
// misleading 0.
export function readCount(result: { count: number | null; error: { message: string } | null }, label: string): number {
  if (result.error) {
    console.error(`Count query failed (${label}):`, result.error.message);
    return 0;
  }
  return result.count ?? 0;
}
