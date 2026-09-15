-- getBusinessProfitSnapshot() paged through every order in the window plus
-- every one of their order_items (chunked by 200 order ids, to avoid an
-- earlier statement-timeout from doing it as one big join — see
-- profitability-repository.ts's history) just to sum revenue/costs and
-- flag which orders have complete cost data, entirely in JavaScript.
-- Preparing for real bulk-import volume (~700 orders/day): this replaces
-- all of that with one Postgres aggregate query. Same "exclude, don't
-- zero-fill" rule as before — an order only counts if ad_cost,
-- shipping_cost, AND every line item's unit_cost are known; an order with
-- zero line items is NOT treated as missing (nothing to be missing),
-- matching the previous JS logic's `.some()` on an empty array being false.
create or replace function public.get_business_profit_snapshot(since timestamptz)
returns table (
  revenue numeric,
  ad_cost numeric,
  shipping_cost numeric,
  cogs numeric,
  orders_considered bigint,
  orders_missing_cost_data bigint
)
language sql
stable
as $$
  with windowed_orders as (
    select o.id, o.total_amount, o.ad_cost, o.shipping_cost
    from public.orders o
    where o.ordered_at >= since
  ),
  order_cogs as (
    select
      oi.order_id,
      sum(oi.quantity * oi.unit_cost) as cogs,
      bool_or(oi.unit_cost is null) as missing_item_cost
    from public.order_items oi
    where oi.order_id in (select id from windowed_orders)
    group by oi.order_id
  ),
  scored as (
    select
      wo.total_amount,
      wo.ad_cost,
      wo.shipping_cost,
      oc.cogs,
      (wo.ad_cost is not null and wo.shipping_cost is not null and coalesce(oc.missing_item_cost, false) = false) as has_full_cost_data
    from windowed_orders wo
    left join order_cogs oc on oc.order_id = wo.id
  )
  select
    coalesce(sum(total_amount) filter (where has_full_cost_data), 0),
    coalesce(sum(ad_cost) filter (where has_full_cost_data), 0),
    coalesce(sum(shipping_cost) filter (where has_full_cost_data), 0),
    coalesce(sum(cogs) filter (where has_full_cost_data), 0),
    count(*) filter (where has_full_cost_data),
    count(*) filter (where not has_full_cost_data)
  from scored;
$$;

grant execute on function public.get_business_profit_snapshot(timestamptz) to authenticated;
