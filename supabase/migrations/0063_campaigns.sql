-- Phase 16 (growth roadmap): multi-step automated campaigns — the gap
-- flagged in the market-comparison doc (Klaviyo-style delayed sequences),
-- distinct from the existing automation engine (Phase 4), which is purely
-- event-reactive with no concept of "wait N days, then do the next thing."
--
-- A campaign is a named sequence of steps (each with its own delay/channel/
-- message). Enrollment happens two ways: automatically on the order.delivered
-- event (post-purchase sequences), or via the daily maintenance cron scanning
-- for win-back-eligible customers (customer_inactive trigger) — both call the
-- same enrollCustomerInCampaign() service function, never insert directly.

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type text not null, -- 'order_delivered' | 'customer_inactive'
  is_active boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_campaigns_updated_at before update on public.campaigns for each row execute function public.set_updated_at();

create table public.campaign_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  step_order integer not null,
  -- 0 = send immediately on enrollment; N = wait N days after enrollment.
  delay_days integer not null default 0,
  channel text not null default 'whatsapp',
  message_template text not null,
  created_at timestamptz not null default now(),
  unique (campaign_id, step_order)
);

create index idx_campaign_steps_campaign_id on public.campaign_steps(campaign_id, step_order);

-- One row per customer's run through a campaign. next_send_at drives the
-- cron-processed queue (idx below); status moves active -> completed (ran out
-- of steps) or active -> exited (customer already ordered again — the
-- sequence's job is done, further nudging would be noise, not help).
create table public.campaign_enrollments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  related_order_id uuid references public.orders(id) on delete set null,
  current_step_index integer not null default 0,
  next_send_at timestamptz not null,
  status text not null default 'active', -- active | completed | exited
  exit_reason text,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_campaign_enrollments_due on public.campaign_enrollments(status, next_send_at) where status = 'active';
create index idx_campaign_enrollments_customer on public.campaign_enrollments(customer_id);
-- One active run per customer per campaign at a time — enrollCustomerInCampaign()
-- also checks this before inserting, but the constraint is the real guarantee.
create unique index idx_campaign_enrollments_one_active on public.campaign_enrollments(campaign_id, customer_id) where status = 'active';

alter table public.campaigns enable row level security;
alter table public.campaign_steps enable row level security;
alter table public.campaign_enrollments enable row level security;

-- Marketing is explicitly the role this feature is for, alongside the usual
-- full-access roles — same reasoning as segments.manage being granted to
-- 'marketing' at the app-permission layer.
create policy "campaigns_all" on public.campaigns for all to authenticated
  using (public.is_full_access() or public.current_user_role() = 'marketing')
  with check (public.is_full_access() or public.current_user_role() = 'marketing');

create policy "campaign_steps_all" on public.campaign_steps for all to authenticated
  using (public.is_full_access() or public.current_user_role() = 'marketing')
  with check (public.is_full_access() or public.current_user_role() = 'marketing');

-- Read-only for authenticated users — every write to enrollments happens
-- through the admin client from the event subscriber or the cron endpoint,
-- neither of which has a user session to satisfy a `with check` anyway.
create policy "campaign_enrollments_select" on public.campaign_enrollments for select to authenticated
  using (public.is_full_access() or public.current_user_role() = 'marketing');

insert into public.permissions (key, description) values
  ('campaigns.view', 'View automated campaigns and their enrollment stats'),
  ('campaigns.manage', 'Create, edit, and activate automated multi-step campaigns')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in ('campaigns.view', 'campaigns.manage')
where r.name in ('admin', 'manager', 'marketing')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'campaigns.view'
where r.name = 'supervisor'
on conflict do nothing;
