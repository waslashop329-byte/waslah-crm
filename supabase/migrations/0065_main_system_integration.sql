-- Part 22b: the real operations-system integration, now that API docs and a
-- live key exist. Adds the integrations row (mirrors the mock's seed row —
-- non-secret connection info only; the API key itself lives in
-- MAIN_SYSTEM_API_KEY, an env var, never this table) and seeds
-- external_status_mappings for the source's status.key vocabulary.
--
-- Their API only confirmed 3 status.key values by name ("new", "confirmed",
-- "cancelled", "…") but gave a complete 7-value `stage` enum (NEW,
-- CONFIRMATION, CONFIRMED, SHIPPED, DELIVERED, CANCELLED, RETURNED) with an
-- explicit warning to key business logic off status.key, never status.name
-- (mutable from their merchant dashboard). These rows are a best-effort
-- starting mapping assuming status.key values parallel the stage names
-- lowercased — any status.key actually seen that isn't one of these falls
-- back to 'pending' (applyStatusMapping()'s safe default), never crashes
-- and never silently miscounts as delivered/cancelled. Add more rows here
-- once the full status.key vocabulary is confirmed.
insert into public.integrations (name, provider, type, capabilities, config, is_active, status)
values (
  'Waslah Ops System',
  'main_system',
  'rest',
  '["testConnection", "fetchCustomers", "fetchOrders", "fetchUpdatedOrders"]'::jsonb,
  '{}'::jsonb,
  true,
  'not_configured'
)
on conflict do nothing;

insert into public.external_status_mappings (source, external_status, internal_status) values
  ('main_system', 'new', 'new'),
  ('main_system', 'confirmation', 'pending'),
  ('main_system', 'confirmed', 'confirmed'),
  ('main_system', 'shipped', 'shipped'),
  ('main_system', 'delivered', 'delivered'),
  ('main_system', 'cancelled', 'cancelled'),
  ('main_system', 'returned', 'returned')
on conflict (source, external_status) do nothing;
