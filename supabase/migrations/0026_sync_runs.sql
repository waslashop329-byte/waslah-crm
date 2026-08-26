-- Renamed from sync_logs: same concept (Phase 1 called it "sync log", Phase 3's
-- spec calls it "sync run"), extended with the per-run breakdown Part 11 wants.
alter table public.sync_logs rename to sync_runs;
alter table public.sync_runs rename column records_processed to total_records;
alter table public.sync_runs rename column created_at to started_at;

alter table public.sync_runs
  add column sync_type text not null default 'manual', -- manual | scheduled | webhook
  add column successful_records integer not null default 0,
  add column failed_records integer not null default 0,
  add column error_summary text,
  add column triggered_by uuid references public.profiles(id);

-- status values going forward: queued | running | completed | partially_failed | failed
alter index idx_sync_logs_status rename to idx_sync_runs_status;
alter index idx_sync_logs_created_at rename to idx_sync_runs_started_at;

create table public.sync_run_items (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.sync_runs(id) on delete cascade,
  entity_type text not null, -- customer | order
  external_id text,
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  status text not null default 'success', -- success | failed | skipped
  error text,
  created_at timestamptz not null default now()
);

create index idx_sync_run_items_sync_run_id on public.sync_run_items(sync_run_id);
create index idx_sync_run_items_status on public.sync_run_items(status);

alter table public.sync_run_items enable row level security;

create policy "sync_run_items_all" on public.sync_run_items for all to authenticated
  using (public.is_full_access()) with check (public.is_full_access());
