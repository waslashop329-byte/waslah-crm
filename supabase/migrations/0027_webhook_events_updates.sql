alter table public.webhook_events
  add column external_event_id text,
  add column retry_count integer not null default 0,
  add column next_retry_at timestamptz;

create index idx_webhook_events_next_retry_at on public.webhook_events(next_retry_at) where next_retry_at is not null;
