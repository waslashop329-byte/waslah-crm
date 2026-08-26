create table public.segments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_dynamic boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- conditions: array of {field, operator, value} combined with AND, e.g.
-- [{"field":"total_orders","operator":">","value":3},{"field":"total_spend","operator":">","value":5000}]
create table public.segment_rules (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references public.segments(id) on delete cascade,
  conditions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_segment_rules_segment_id on public.segment_rules(segment_id);
