alter table public.customer_addresses
  add column area text,
  add column details text;

-- Enforce "only one primary address per customer" at the database level.
create unique index idx_customer_addresses_one_primary
  on public.customer_addresses(customer_id)
  where is_primary;
