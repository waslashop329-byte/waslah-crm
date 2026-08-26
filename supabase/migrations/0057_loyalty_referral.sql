-- Phase 11: loyalty tiers (configurable thresholds, same shape as
-- score_category_thresholds) + referral tracking (self-FK on customers,
-- "Ahmed invited Mohamed").
create table public.loyalty_tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  min_orders integer not null default 0,
  min_spend numeric(14,2) not null default 0,
  benefits text,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_loyalty_tiers_updated_at before update on public.loyalty_tiers for each row execute function public.set_updated_at();

alter table public.loyalty_tiers enable row level security;
create policy "loyalty_tiers_select" on public.loyalty_tiers for select to authenticated using (true);
create policy "loyalty_tiers_write" on public.loyalty_tiers for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

insert into public.loyalty_tiers (name, min_orders, min_spend, benefits, sort_order) values
  ('Bronze', 0, 0, 'Standard support', 1),
  ('Silver', 3, 3000, 'Priority support', 2),
  ('Gold', 6, 8000, 'Priority support + early access to offers', 3),
  ('VIP', 10, 15000, 'Priority support, early access, dedicated follow-up', 4);

alter table public.customers add column referred_by_customer_id uuid references public.customers(id) on delete set null;
create index idx_customers_referred_by on public.customers(referred_by_customer_id) where referred_by_customer_id is not null;

insert into public.permissions (key, description) values
  ('loyalty.manage', 'Configure loyalty tier thresholds')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'loyalty.manage'
where r.name in ('admin', 'manager')
on conflict do nothing;
