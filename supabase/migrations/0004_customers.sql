-- The core customer-centric entity. Order stats are denormalized onto this row
-- (updated by the sync/automation layer in later phases) so the Customers list
-- and Customer 360 header can render from a single fast lookup instead of
-- aggregating the full order/event history on every page view.
create table public.customers (
  id uuid primary key default gen_random_uuid(),

  full_name text not null,
  email text,
  status text not null default 'active', -- active | inactive | blocked | merged
  source text,                            -- e.g. 'main_system', 'manual'
  external_id text,                       -- id of this customer in the existing operational system

  assigned_to uuid references public.profiles(id),
  merged_into uuid references public.customers(id),

  customer_since timestamptz not null default now(),

  -- Denormalized statistics, recalculated by the integration/automation layer.
  total_orders integer not null default 0,
  delivered_orders integer not null default 0,
  cancelled_orders integer not null default 0,
  returned_orders integer not null default 0,
  total_spend numeric(14,2) not null default 0,
  avg_order_value numeric(14,2) not null default 0,
  first_order_at timestamptz,
  last_order_at timestamptz,

  -- Denormalized current score; full history lives in score_history.
  score integer not null default 0,
  score_category text not null default 'medium_risk', -- excellent | trusted | medium_risk | high_risk

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create extension if not exists pg_trgm;

create unique index idx_customers_external_id on public.customers(external_id) where external_id is not null;
create index idx_customers_assigned_to on public.customers(assigned_to);
create index idx_customers_status on public.customers(status);
create index idx_customers_score on public.customers(score);
create index idx_customers_last_order_at on public.customers(last_order_at);
create index idx_customers_full_name_trgm on public.customers using gin (full_name gin_trgm_ops);
