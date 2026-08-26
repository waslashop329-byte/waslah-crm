-- Strongest-priority customer-matching key (Part 4): one customer can have
-- external ids from several sources (main system, Shopify, EasyOrders, ...),
-- so this is a proper join table, unlike orders which only ever have one source.
create table public.customer_external_ids (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  source text not null,
  external_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index idx_customer_external_ids_source_external on public.customer_external_ids(source, external_id);
create index idx_customer_external_ids_customer_id on public.customer_external_ids(customer_id);

alter table public.customer_external_ids enable row level security;

create policy "customer_external_ids_all" on public.customer_external_ids for all to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));
