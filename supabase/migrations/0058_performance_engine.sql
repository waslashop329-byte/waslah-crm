-- Phase 12: Performance Engine — a confirmation-agent leaderboard, XP, a
-- configurable commission-rate preview (not real payroll — there's no
-- payroll integration, this shows what an agent WOULD earn at the
-- configured rate), and per-agent monthly goals.
create table public.agent_goals (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.profiles(id),
  period_month text not null, -- 'YYYY-MM'
  target_confirmed_orders integer not null default 0,
  target_revenue numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, period_month)
);

create trigger trg_agent_goals_updated_at before update on public.agent_goals for each row execute function public.set_updated_at();

alter table public.agent_goals enable row level security;
create policy "agent_goals_select" on public.agent_goals for select to authenticated using (true);
create policy "agent_goals_write" on public.agent_goals for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

-- Singleton config row — same shape as scoring_rules/loyalty_tiers'
-- "editable in Settings" pattern, just a single row instead of many.
create table public.performance_config (
  id uuid primary key default gen_random_uuid(),
  commission_rate_percent numeric(5,2) not null default 5,
  xp_per_confirmed_order integer not null default 10,
  xp_per_completed_followup integer not null default 5,
  updated_at timestamptz not null default now()
);

create trigger trg_performance_config_updated_at before update on public.performance_config for each row execute function public.set_updated_at();

alter table public.performance_config enable row level security;
create policy "performance_config_select" on public.performance_config for select to authenticated using (true);
create policy "performance_config_write" on public.performance_config for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

insert into public.performance_config (commission_rate_percent, xp_per_confirmed_order, xp_per_completed_followup) values (5, 10, 5);

insert into public.permissions (key, description) values
  ('performance.view', 'View the agent performance leaderboard'),
  ('performance.manage', 'Configure commission rate, XP weights, and agent goals')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in ('performance.view', 'performance.manage')
where r.name in ('admin', 'manager')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'performance.view'
where r.name = 'supervisor'
on conflict do nothing;
