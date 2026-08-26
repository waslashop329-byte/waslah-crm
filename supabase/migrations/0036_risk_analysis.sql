-- One row per customer (like the denormalized stats on `customers` itself):
-- risk needs to be filtered/sorted by segments and the dashboard at scale, so
-- it's a real table kept in sync by the risk service, not computed on read.
create table public.customer_risk_profiles (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  cancellation_risk numeric(5,2) not null default 0, -- percentage, 0-100
  delivery_risk numeric(5,2) not null default 0,
  return_risk numeric(5,2) not null default 0,
  overall_risk numeric(5,2) not null default 0,
  cancellation_risk_category text not null default 'low', -- low | medium | high
  delivery_risk_category text not null default 'low',
  return_risk_category text not null default 'low',
  overall_risk_category text not null default 'low',
  computed_at timestamptz not null default now()
);

alter table public.customer_risk_profiles enable row level security;
create policy "customer_risk_profiles_select" on public.customer_risk_profiles for select to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));

-- Configurable per risk type (Part 3): min_threshold is the inclusive lower
-- bound (percentage) for that category, e.g. cancellation >= 40% = high.
create table public.risk_config (
  id uuid primary key default gen_random_uuid(),
  risk_type text not null, -- cancellation | delivery | return | overall
  category text not null,  -- low | medium | high
  min_threshold numeric(5,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_risk_config_type_category on public.risk_config(risk_type, category);

create trigger trg_risk_config_updated_at before update on public.risk_config for each row execute function public.set_updated_at();

alter table public.risk_config enable row level security;
create policy "risk_config_select" on public.risk_config for select to authenticated using (true);
create policy "risk_config_write" on public.risk_config for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

insert into public.risk_config (risk_type, category, min_threshold) values
  ('cancellation', 'low', 0), ('cancellation', 'medium', 20), ('cancellation', 'high', 40),
  ('delivery', 'low', 0), ('delivery', 'medium', 15), ('delivery', 'high', 30),
  ('return', 'low', 0), ('return', 'medium', 15), ('return', 'high', 30),
  ('overall', 'low', 0), ('overall', 'medium', 20), ('overall', 'high', 40);
