-- Superseded by customer_external_ids (Part 4 needs multi-source ids per
-- customer, e.g. main_system + Shopify simultaneously — a single column can't
-- express that). Never referenced by application code yet, safe to drop.
drop index if exists idx_customers_external_id;
alter table public.customers drop column external_id;
