-- Pre-joins the fields the Customers list needs (primary phone, active tags,
-- order ids for search) so listing/searching/filtering is one indexed query
-- instead of N+1 lookups per row. security_invoker means the view runs with
-- the querying user's own RLS, not the view owner's — it never widens access.
create view public.customer_list_view
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
  coalesce(tg.tag_ids, '{}') as tag_ids
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
