-- An order only ever comes from one source, so (source, external_order_id) —
-- not external_order_id alone — is the correct idempotency key for sync (Part 5).
alter table public.orders add column source text not null default 'manual';

drop index if exists idx_orders_external_order_id;

create unique index idx_orders_source_external_order_id
  on public.orders(source, external_order_id)
  where external_order_id is not null;
