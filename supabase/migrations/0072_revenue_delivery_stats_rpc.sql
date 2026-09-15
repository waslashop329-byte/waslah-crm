-- getRevenueDeliveryStats() currently pages through every delivered order
-- in the window (fetchAllRows, joined to customers) just to SUM
-- total_amount in JavaScript — at current scale that's a few hundred rows,
-- fine; at ~700 orders/day real volume, a 30-day window is ~20,000+ rows
-- pulled into Node just to add them up, on every dashboard load. Postgres
-- can do this in one pass without ever materializing the rows to the
-- client.
create or replace function public.get_revenue_delivery_stats(since timestamptz)
returns table (
  orders_last_30d bigint,
  delivered_last_30d bigint,
  revenue_last_30d numeric,
  repeat_revenue_last_30d numeric,
  cancelled_last_30d bigint,
  returned_last_30d bigint
)
language sql
stable
as $$
  select
    count(*) filter (where o.ordered_at >= since),
    count(*) filter (where o.status = 'delivered' and o.ordered_at >= since),
    coalesce(sum(o.total_amount) filter (where o.status = 'delivered' and o.ordered_at >= since), 0),
    coalesce(sum(o.total_amount) filter (where o.status = 'delivered' and o.ordered_at >= since and c.total_orders > 1), 0),
    count(*) filter (where o.status = 'cancelled' and o.ordered_at >= since),
    count(*) filter (where o.status = 'returned' and o.ordered_at >= since)
  from public.orders o
  join public.customers c on c.id = o.customer_id
  where o.ordered_at >= since;
$$;

grant execute on function public.get_revenue_delivery_stats(timestamptz) to authenticated;
