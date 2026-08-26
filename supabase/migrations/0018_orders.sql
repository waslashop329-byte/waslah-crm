-- CRM-local order records. Phase 1 kept orders purely external; Phase 2 needs a
-- working Orders tab before the Phase 3 sync/integration exists, so this table
-- is the sync target: rows here are seeded for dev today and will be
-- created/updated by the integration layer once it ships. external_order_id
-- is how the future sync will find-or-create the matching row idempotently.
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  external_order_id text,
  status text not null default 'pending', -- pending | confirmed | shipped | delivered | cancelled | returned
  product_summary text,
  total_amount numeric(14,2) not null default 0,
  ordered_at timestamptz not null default now(),
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_orders_external_order_id on public.orders(external_order_id) where external_order_id is not null;
create index idx_orders_customer_id on public.orders(customer_id, ordered_at desc);
create index idx_orders_status on public.orders(status);

create trigger trg_orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

alter table public.orders enable row level security;

create policy "orders_all" on public.orders for all to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));
