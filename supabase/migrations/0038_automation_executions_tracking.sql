-- Part 12/13: richer execution tracking + the idempotency key that prevents
-- the same automation running twice for the same triggering event (loop/
-- duplicate-execution protection).
alter table public.automation_executions rename column executed_at to started_at;

alter table public.automation_executions
  add column trigger_event text,
  add column completed_at timestamptz,
  add column error text,
  add column idempotency_key text;

-- status vocabulary widens from success|failed to pending|running|completed|failed|skipped
update public.automation_executions set status = 'completed' where status = 'success';
alter table public.automation_executions alter column status set default 'pending';

create unique index idx_automation_executions_idempotency on public.automation_executions(idempotency_key) where idempotency_key is not null;
create index idx_automation_executions_trigger_event on public.automation_executions(trigger_event);
create index idx_automation_executions_rule_started_at on public.automation_executions(automation_rule_id, started_at desc);
