-- automation_executions.automation_rule_id was "on delete cascade" (migration
-- 0015), which would silently wipe execution history the moment someone
-- deletes a rule from /automations — contradicting the "never delete
-- historical information" principle applied everywhere else (soft-deleted
-- customers, soft-removed tags, merge-preserved records, ...). The execution
-- row itself already carries trigger_event/customer_id/result/error, so it's
-- still meaningful even once its rule is gone.
alter table public.automation_executions alter column automation_rule_id drop not null;
alter table public.automation_executions drop constraint automation_executions_automation_rule_id_fkey;
alter table public.automation_executions
  add constraint automation_executions_automation_rule_id_fkey
  foreign key (automation_rule_id) references public.automation_rules(id) on delete set null;
