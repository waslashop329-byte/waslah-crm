-- Phase 15 (growth roadmap): extends segment_customer_view with three more
-- text[] columns so the segment engine's existing "tag" field type (a plain
-- array-contains match, already used for tag_names) can also match on
-- location, product category, and specific product — no evaluator changes
-- needed, since the "contains" query path is already generic over any
-- text[] column, not hardcoded to the tags table.
--
-- CREATE OR REPLACE VIEW requires every pre-existing column to stay in the
-- same position — only appending new columns at the end is safe.
create or replace view public.segment_customer_view
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
  coalesce(rp.overall_risk_category, 'low') as overall_risk_category,
  coalesce(loc.governorates, '{}') as governorates,
  coalesce(cat.categories, '{}') as purchased_categories,
  coalesce(prod.products, '{}') as purchased_products
from public.customers c
left join lateral (
  select array_agg(t.name) as tag_names
  from public.customer_tags ct
  join public.tags t on t.id = ct.tag_id
  where ct.customer_id = c.id and ct.removed_at is null
) tg on true
left join public.customer_risk_profiles rp on rp.customer_id = c.id
left join lateral (
  select array_agg(distinct a.governorate) as governorates
  from public.customer_addresses a
  where a.customer_id = c.id and a.governorate is not null
) loc on true
left join lateral (
  -- Only order_items whose line item was matched to a catalog product carry
  -- a category — unmatched raw-text items are silently excluded, same
  -- "don't guess at missing data" principle used everywhere else.
  select array_agg(distinct p.category) as categories
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.products p on p.id = oi.product_id
  where o.customer_id = c.id and p.category is not null
) cat on true
left join lateral (
  -- Uses the line item's own raw product text (always present, catalog
  -- match or not) so "has this customer bought product X" works even for
  -- orders that were never matched to a catalog entry.
  select array_agg(distinct oi.product_name_raw) as products
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.customer_id = c.id
) prod on true;
