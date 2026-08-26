-- Phase 13 (simplified, by explicit user choice): "AI Call Analysis" without
-- real call recordings — this CRM has no telephony integration, only the
-- free-text notes a confirmation agent already types when logging a call
-- attempt (Phase 7). The AI analyzes that text instead of audio it doesn't have.
create table public.call_attempt_analysis (
  call_attempt_id uuid primary key references public.order_call_attempts(id) on delete cascade,
  quality_score numeric(5,2), -- 0-100
  attempted_upsell boolean,
  customer_objection text,
  improvement_suggestion text,
  provider text not null,
  model text not null,
  generated_at timestamptz not null default now()
);

alter table public.call_attempt_analysis enable row level security;
create policy "call_attempt_analysis_select" on public.call_attempt_analysis for select to authenticated using (true);
create policy "call_attempt_analysis_write" on public.call_attempt_analysis for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

insert into public.permissions (key, description) values
  ('ai.call_analysis.generate', 'Generate AI analysis of a logged call attempt''s notes')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'ai.call_analysis.generate'
where r.name in ('admin', 'manager', 'supervisor')
on conflict do nothing;
