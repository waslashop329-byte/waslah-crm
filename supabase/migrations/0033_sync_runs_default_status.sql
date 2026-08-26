-- sync_runs inherited status default 'processing' from the old sync_logs
-- vocabulary (success|failed|processing|retrying). The Phase 3 vocabulary is
-- queued|running|completed|partially_failed|failed — fix the stale default.
alter table public.sync_runs alter column status set default 'queued';
