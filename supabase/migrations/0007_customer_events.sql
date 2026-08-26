-- Generic, extensible timeline. New event_type values never require a migration:
-- event_type is free text and metadata carries whatever shape that event needs.
create table public.customer_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  event_type text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  related_order_id text,
  related_employee_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_customer_events_customer_id on public.customer_events(customer_id, created_at desc);
create index idx_customer_events_event_type on public.customer_events(event_type);
