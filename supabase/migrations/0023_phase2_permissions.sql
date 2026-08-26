-- Additive, granular permissions needed by Phase 2 features. Existing Phase 1
-- keys (customers.view_all, customers.edit, customers.merge, follow_ups.manage_all,
-- tags.manage, ...) are untouched; these are new, finer-grained actions checked
-- directly by the Phase 2 UI (e.g. "can this user delete this note").
insert into public.permissions (key, description) values
  ('customers.view', 'View customer profiles (scope still enforced by RLS/assignment)'),
  ('customers.delete', 'Soft-delete a customer'),
  ('notes.create', 'Add a note to a customer'),
  ('notes.edit', 'Edit any customer note (not just your own)'),
  ('notes.delete', 'Delete any customer note (not just your own)'),
  ('follow_ups.create', 'Create a follow-up'),
  ('follow_ups.edit', 'Edit any follow-up (not just your own)'),
  ('follow_ups.assign', 'Reassign a follow-up to another employee'),
  ('follow_ups.complete', 'Mark a follow-up completed or cancelled')
on conflict (key) do nothing;

-- admin: everything (including whatever was just inserted above)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.key in (
  'customers.view', 'customers.delete', 'notes.create', 'notes.edit', 'notes.delete',
  'follow_ups.create', 'follow_ups.edit', 'follow_ups.assign', 'follow_ups.complete'
)
where r.name = 'admin'
on conflict do nothing;

-- manager: everything Phase 2 adds
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.key in (
  'customers.view', 'customers.delete', 'notes.create', 'notes.edit', 'notes.delete',
  'follow_ups.create', 'follow_ups.edit', 'follow_ups.assign', 'follow_ups.complete'
)
where r.name = 'manager'
on conflict do nothing;

-- supervisor: team-management actions, no hard delete
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.key in (
  'customers.view', 'notes.create', 'notes.edit',
  'follow_ups.create', 'follow_ups.edit', 'follow_ups.assign', 'follow_ups.complete'
)
where r.name = 'supervisor'
on conflict do nothing;

-- employee/support: day-to-day actions on their own assigned customers only (RLS-scoped)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.key in ('customers.view', 'notes.create', 'follow_ups.create', 'follow_ups.complete')
where r.name in ('employee', 'support')
on conflict do nothing;

-- marketing: read + notes, no follow-up ownership
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.key in ('customers.view', 'notes.create')
where r.name = 'marketing'
on conflict do nothing;
