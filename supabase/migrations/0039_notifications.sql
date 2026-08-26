-- Internal notifications only (Part 17) — no email/WhatsApp delivery here.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null, -- high_risk_customer | duplicate_candidate | automation_failed | follow_up_assigned
  title text not null,
  message text not null,
  related_entity_type text,
  related_entity_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_recipient on public.notifications(recipient_id, is_read, created_at desc);

alter table public.notifications enable row level security;
create policy "notifications_select" on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy "notifications_update" on public.notifications for update to authenticated using (recipient_id = auth.uid());
create policy "notifications_insert" on public.notifications for insert to authenticated with check (public.is_full_access());
