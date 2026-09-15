-- getMarketingMetrics() pulled every non-deleted customer's total_spend
-- (fetchAllRows, paging past the 1000-row cap) just to average it in
-- JavaScript. Preparing for real bulk-import volume (~700 orders/day,
-- likely 100,000+ customers eventually): a plain AVG() never needs the
-- individual rows on the client at all.
create or replace function public.get_average_customer_ltv()
returns numeric
language sql
stable
as $$
  select avg(total_spend) from public.customers where deleted_at is null;
$$;

grant execute on function public.get_average_customer_ltv() to authenticated;
