-- Found live: the dashboard's Promise.all fires ~12 separate COUNT queries
-- at once (getDashboardStats alone), several of them against the same
-- customers/customer_list_view table with different WHERE filters — and
-- with the real customer base past ~11,000, that burst of concurrent load
-- started causing individual queries to intermittently hit a statement
-- timeout. The calling code used `.count ?? 0` everywhere with no error
-- check, so a timed-out query silently reported 0 instead of the real
-- number (confirmed live: "Total Customers: 0" on the dashboard while the
-- CAC table on the very same page correctly showed 11,698 from a
-- different, un-timed-out query).
--
-- This collapses 8 of those separate customer-count queries into one
-- query using FILTER clauses, cutting that much concurrent load. Queries
-- the base `customers` table directly, not customer_list_view — the view
-- exists so PostgREST-issued queries can filter on cancelled_gt_delivered
-- (a real column-to-column comparison PostgREST's client-side .filter()
-- can't express — see migration 0061), but it does that by joining every
-- row against customer_phones/customer_tags/orders via LATERAL subqueries.
-- A raw SQL function has no such limitation: it can compare
-- cancelled_orders > delivered_orders directly, so this gets the same
-- boolean without paying for those three joins on every one of ~11,000+
-- rows just to produce a count.
create or replace function public.get_dashboard_customer_counts(thirty_days_ago timestamptz, ninety_days_ago timestamptz)
returns table (
  total_customers bigint,
  new_customers_30d bigint,
  repeat_customers bigint,
  excellent_customers bigint,
  trusted_customers bigint,
  at_risk_customers bigint,
  high_cancellation_risk_customers bigint,
  inactive_customers bigint
)
language sql
stable
as $$
  select
    count(*) filter (where deleted_at is null),
    count(*) filter (where deleted_at is null and customer_since >= thirty_days_ago),
    count(*) filter (where deleted_at is null and total_orders > 1),
    count(*) filter (where deleted_at is null and score_category = 'excellent'),
    count(*) filter (where deleted_at is null and score_category = 'trusted'),
    count(*) filter (where deleted_at is null and score_category = 'high_risk'),
    count(*) filter (where deleted_at is null and cancelled_orders > delivered_orders),
    count(*) filter (where deleted_at is null and (last_order_at < ninety_days_ago or last_order_at is null))
  from public.customers;
$$;

-- RLS still applies normally (this is a plain `sql`/`stable` function, not
-- `security definer`) — it runs with the calling user's own row visibility,
-- same as the separate queries it replaces, so a non-admin user still only
-- ever sees counts scoped to their own assigned customers.
grant execute on function public.get_dashboard_customer_counts(timestamptz, timestamptz) to authenticated;
