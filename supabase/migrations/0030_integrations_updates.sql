alter table public.integrations
  add column provider text not null default 'mock',
  add column capabilities jsonb not null default '[]'::jsonb,
  add column status text not null default 'not_configured', -- not_configured | connected | disconnected | error
  add column last_sync_at timestamptz,
  add column last_success_at timestamptz,
  add column last_failure_at timestamptz;
