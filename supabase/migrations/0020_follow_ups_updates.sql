alter table public.follow_ups
  add column title text not null default 'Follow-up',
  add column completed_by uuid references public.profiles(id);

alter table public.follow_ups alter column title drop default;

-- 'overdue' is now computed dynamically (status = 'pending' AND due_date < now()),
-- never stored. Backfill any Phase 1 seed rows that had it stored.
update public.follow_ups set status = 'pending' where status = 'overdue';
