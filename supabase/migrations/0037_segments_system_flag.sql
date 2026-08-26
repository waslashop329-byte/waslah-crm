-- Part 9: system segments (VIP, Repeat, Inactive, ...) are protected from
-- deletion and visually distinct from custom ones.
alter table public.segments add column is_system boolean not null default false;

update public.segments set is_system = true
where name in ('VIP Customers', 'High Cancellation Risk', 'Inactive 90 Days');
