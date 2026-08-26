-- config holds non-secret connection details (base_url, mappings). Real credentials
-- belong in environment variables / a secrets manager, never in this table.
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'rest', -- rest | webhook
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references public.integrations(id) on delete set null,
  source text not null,
  event_type text,
  status text not null default 'processing', -- success | failed | processing | retrying
  records_processed integer not null default 0,
  errors jsonb,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index idx_sync_logs_status on public.sync_logs(status);
create index idx_sync_logs_created_at on public.sync_logs(created_at desc);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  event_type text not null,
  payload jsonb not null,
  idempotency_key text not null unique,
  status text not null default 'pending', -- pending | processed | failed
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_webhook_events_status on public.webhook_events(status);
