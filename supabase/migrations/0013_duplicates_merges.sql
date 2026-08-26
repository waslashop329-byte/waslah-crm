create table public.duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  customer_id_a uuid not null references public.customers(id) on delete cascade,
  customer_id_b uuid not null references public.customers(id) on delete cascade,
  confidence_score numeric(5,2) not null,
  signals jsonb not null default '[]'::jsonb, -- e.g. ["same_phone","similar_name"]
  status text not null default 'pending', -- pending | ignored | merged
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

-- One candidate row per unordered pair, regardless of which id was stored first.
create unique index idx_duplicate_candidates_pair on public.duplicate_candidates (
  least(customer_id_a, customer_id_b),
  greatest(customer_id_a, customer_id_b)
);

-- Merges are never destructive: the losing customer row stays (status='merged',
-- merged_into set on customers) so every order/timeline/note it ever had is still
-- reachable. This table is the audit trail of who merged what into what.
create table public.customer_merges (
  id uuid primary key default gen_random_uuid(),
  primary_customer_id uuid not null references public.customers(id),
  merged_customer_id uuid not null references public.customers(id),
  merged_by uuid references public.profiles(id),
  audit jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
