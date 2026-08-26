create table public.score_history (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  score integer not null,
  category text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index idx_score_history_customer_id on public.score_history(customer_id, created_at desc);

-- Configurable scoring weights so the scoring algorithm (Phase 4) never hardcodes numbers.
create table public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,   -- e.g. 'delivered_order', 'cancelled_order', 'recent_activity'
  label text not null,
  weight numeric(6,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
