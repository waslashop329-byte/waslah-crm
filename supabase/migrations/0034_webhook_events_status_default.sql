-- Part 7's vocabulary is received|processing|processed|failed|duplicate.
-- Phase 1's default was 'pending' from an earlier, looser vocabulary.
alter table public.webhook_events alter column status set default 'received';
update public.webhook_events set status = 'received' where status = 'pending';
