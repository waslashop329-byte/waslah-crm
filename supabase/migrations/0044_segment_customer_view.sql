-- Pre-joins everything a segment rule might reference (tags, risk categories)
-- onto one row per customer, same reasoning as customer_list_view (Phase 2):
-- one indexed query instead of the segment evaluator doing its own joins/
-- N+1 lookups every time a segment is previewed or evaluated.
create view public.segment_customer_view
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
  c.deleted_at,
  coalesce(tg.tag_names, '{}') as tag_names,
  coalesce(rp.cancellation_risk_category, 'low') as cancellation_risk_category,
  coalesce(rp.delivery_risk_category, 'low') as delivery_risk_category,
  coalesce(rp.return_risk_category, 'low') as return_risk_category,
  coalesce(rp.overall_risk_category, 'low') as overall_risk_category
from public.customers c
left join lateral (
  select array_agg(t.name) as tag_names
  from public.customer_tags ct
  join public.tags t on t.id = ct.tag_id
  where ct.customer_id = c.id and ct.removed_at is null
) tg on true
left join public.customer_risk_profiles rp on rp.customer_id = c.id;
