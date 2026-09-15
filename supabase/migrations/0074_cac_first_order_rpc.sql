-- getCacBySource() fetched every customer in the acquisition window, then
-- chunked their ids into batches of 200 to find each one's first order (a
-- fix for an earlier live statement-timeout from one huge `.in()` list —
-- see the comment this replaces), then grouped by source in JavaScript.
-- Preparing for real bulk-import volume (~700 orders/day): a customer's
-- "first order" is exactly what DISTINCT ON is for — one pass over orders,
-- no per-chunk round trips regardless of how many customers qualify.
-- calculateCacBySource() (lib/intelligence/economics/cac.ts) keeps doing
-- the final per-source grouping/averaging unchanged — that part was never
-- the bottleneck, it processes one row per customer already in memory.
create or replace function public.get_customer_acquisition_first_order_cost(since timestamptz)
returns table (
  source text,
  first_order_ad_cost numeric
)
language sql
stable
as $$
  with first_orders as (
    select distinct on (customer_id) customer_id, ad_cost
    from public.orders
    order by customer_id, ordered_at asc
  )
  select
    coalesce(ca.source, 'untagged'),
    fo.ad_cost
  from public.customers c
  left join public.customer_acquisition ca on ca.customer_id = c.id
  left join first_orders fo on fo.customer_id = c.id
  where c.deleted_at is null and c.customer_since >= since;
$$;

grant execute on function public.get_customer_acquisition_first_order_cost(timestamptz) to authenticated;
