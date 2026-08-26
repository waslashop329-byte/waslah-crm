-- PostgREST has no column-to-column comparison operator in its query-string
-- filter syntax (`?cancelled_orders=gt.delivered_orders` casts the literal
-- string "delivered_orders" to the column's type and fails, or — for a
-- head-only count query whose caller ignores `.error` — silently returns 0).
-- dashboard-repository.ts's "High Cancellation Risk" KPI has been doing
-- exactly that broken filter since Phase 4 and always returning 0, silently,
-- because it falls back with `?? 0` on error. Adding a real boolean column
-- computed in the view is the only reliable way to filter on this in a
-- single indexed query from PostgREST.
create or replace view public.customer_list_view
with (security_invoker = true) as
select
  c.id,
  c.full_name,
  c.email,
  c.status,
  c.score,
  c.score_category,
  c.total_orders,
  c.delivered_orders,
  c.cancelled_orders,
  c.returned_orders,
  c.total_spend,
  c.avg_order_value,
  c.last_order_at,
  c.customer_since,
  c.assigned_to,
  c.created_at,
  c.deleted_at,
  ph.phone as primary_phone,
  coalesce(ord.order_ids, '') as order_ids,
  coalesce(tg.tag_names, '{}') as tag_names,
  coalesce(tg.tag_ids, '{}') as tag_ids,
  (c.cancelled_orders > c.delivered_orders) as cancelled_gt_delivered
from public.customers c
left join lateral (
  select phone from public.customer_phones cp
  where cp.customer_id = c.id
  order by cp.is_primary desc, cp.created_at asc
  limit 1
) ph on true
left join lateral (
  select
    array_agg(t.name) as tag_names,
    array_agg(ct.tag_id) as tag_ids
  from public.customer_tags ct
  join public.tags t on t.id = ct.tag_id
  where ct.customer_id = c.id and ct.removed_at is null
) tg on true
left join lateral (
  select string_agg(coalesce(o.external_order_id, o.id::text), ' ') as order_ids
  from public.orders o
  where o.customer_id = c.id
) ord on true;
