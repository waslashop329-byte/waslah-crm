-- Phase 10: Experiment Center. This CRM has no live traffic-splitting
-- mechanism (no website/ad-platform integration) — it's a place to RECORD
-- and compare the outcome of a test the ops/marketing team ran elsewhere
-- (a product page, a creative, a confirmation script), not to run one.
create table public.experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null, -- product_page | creative | offer | confirmation_script | upsell
  hypothesis text,
  variant_a_name text not null,
  variant_a_metric_value numeric,
  variant_b_name text not null,
  variant_b_metric_value numeric,
  metric_label text not null default 'Conversion rate (%)',
  status text not null default 'running', -- running | completed
  winner text, -- 'a' | 'b' | 'inconclusive', set when status = completed
  notes text,
  created_by uuid references public.profiles(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_experiments_updated_at before update on public.experiments for each row execute function public.set_updated_at();

alter table public.experiments enable row level security;
create policy "experiments_select" on public.experiments for select to authenticated using (true);
create policy "experiments_write" on public.experiments for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

insert into public.permissions (key, description) values
  ('experiments.manage', 'Record and manage A/B experiment results')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'experiments.manage'
where r.name in ('admin', 'manager')
on conflict do nothing;
