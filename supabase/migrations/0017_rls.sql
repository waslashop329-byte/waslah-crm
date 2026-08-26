-- Row Level Security: baseline tier enforcement (full-access roles vs.
-- employee-scoped-to-assigned-customers). The role_permissions table carries
-- finer-grained, per-action permissions that the app layer checks in later
-- phases; RLS here is the last line of defense at the database itself.

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_phones enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.tags enable row level security;
alter table public.customer_tags enable row level security;
alter table public.customer_events enable row level security;
alter table public.customer_notes enable row level security;
alter table public.follow_ups enable row level security;
alter table public.score_history enable row level security;
alter table public.scoring_rules enable row level security;
alter table public.segments enable row level security;
alter table public.segment_rules enable row level security;
alter table public.integrations enable row level security;
alter table public.sync_logs enable row level security;
alter table public.webhook_events enable row level security;
alter table public.duplicate_candidates enable row level security;
alter table public.customer_merges enable row level security;
alter table public.audit_logs enable row level security;
alter table public.ai_insights enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_executions enable row level security;

create or replace function public.current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select r.name from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid()
$$;

-- admin/manager/supervisor see everything; employee/marketing/support are scoped.
create or replace function public.is_full_access()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'manager', 'supervisor');
$$;

-- Reference data: readable by any authenticated user, writable by full-access roles.
create policy "roles_select" on public.roles for select to authenticated using (true);
create policy "roles_write" on public.roles for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

create policy "permissions_select" on public.permissions for select to authenticated using (true);
create policy "permissions_write" on public.permissions for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

create policy "role_permissions_select" on public.role_permissions for select to authenticated using (true);
create policy "role_permissions_write" on public.role_permissions for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

create policy "tags_select" on public.tags for select to authenticated using (true);
create policy "tags_write" on public.tags for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

create policy "scoring_rules_select" on public.scoring_rules for select to authenticated using (true);
create policy "scoring_rules_write" on public.scoring_rules for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

create policy "segments_select" on public.segments for select to authenticated using (true);
create policy "segments_write" on public.segments for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

create policy "segment_rules_select" on public.segment_rules for select to authenticated using (true);
create policy "segment_rules_write" on public.segment_rules for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

create policy "integrations_all" on public.integrations for all to authenticated using (public.is_full_access()) with check (public.is_full_access());
create policy "sync_logs_all" on public.sync_logs for all to authenticated using (public.is_full_access()) with check (public.is_full_access());
create policy "webhook_events_all" on public.webhook_events for all to authenticated using (public.is_full_access()) with check (public.is_full_access());
create policy "audit_logs_select" on public.audit_logs for select to authenticated using (public.is_full_access());
create policy "duplicate_candidates_all" on public.duplicate_candidates for all to authenticated using (public.is_full_access()) with check (public.is_full_access());
create policy "customer_merges_all" on public.customer_merges for all to authenticated using (public.is_full_access()) with check (public.is_full_access());
create policy "automation_rules_all" on public.automation_rules for all to authenticated using (public.is_full_access()) with check (public.is_full_access());
create policy "automation_executions_select" on public.automation_executions for select to authenticated using (public.is_full_access());

-- Profiles: everyone can read (needed for assignee pickers/avatars); only self or full-access can update.
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_full_access());

-- Customers: full-access roles see all; everyone else only their assigned customers.
create policy "customers_select" on public.customers for select to authenticated
  using (public.is_full_access() or assigned_to = auth.uid());
create policy "customers_insert" on public.customers for insert to authenticated with check (true);
create policy "customers_update" on public.customers for update to authenticated
  using (public.is_full_access() or assigned_to = auth.uid());

-- Child tables follow the parent customer's visibility.
create policy "customer_phones_all" on public.customer_phones for all to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));

create policy "customer_addresses_all" on public.customer_addresses for all to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));

create policy "customer_tags_all" on public.customer_tags for all to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));

create policy "customer_events_select" on public.customer_events for select to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));
create policy "customer_events_insert" on public.customer_events for insert to authenticated
  with check (exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));

create policy "customer_notes_all" on public.customer_notes for all to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));

create policy "follow_ups_all" on public.follow_ups for all to authenticated
  using (public.is_full_access() or assigned_to = auth.uid() or exists (
    select 1 from public.customers c where c.id = customer_id and c.assigned_to = auth.uid()
  ));

create policy "score_history_select" on public.score_history for select to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));

create policy "ai_insights_select" on public.ai_insights for select to authenticated
  using (related_customer_id is null or exists (
    select 1 from public.customers c where c.id = related_customer_id and (public.is_full_access() or c.assigned_to = auth.uid())
  ));
