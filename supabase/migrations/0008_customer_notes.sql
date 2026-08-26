create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  content text not null,
  related_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_customer_notes_customer_id on public.customer_notes(customer_id, created_at desc);
