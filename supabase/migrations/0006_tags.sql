create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#6b7280',
  created_at timestamptz not null default now()
);

-- Soft-removable so tag history survives (see customer_events for the timeline entry).
create table public.customer_tags (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  source text not null default 'manual', -- manual | rule | ai
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  removed_at timestamptz
);

create index idx_customer_tags_customer_id on public.customer_tags(customer_id);
create unique index idx_customer_tags_active on public.customer_tags(customer_id, tag_id) where removed_at is null;
