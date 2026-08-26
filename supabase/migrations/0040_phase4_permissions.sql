-- Phase 1 seeded 'automation.manage' (singular) before the automation engine
-- existed. Phase 4 uses the more granular automations.view/automations.manage
-- pair instead — grep confirms 'automation.manage' is referenced nowhere in
-- application code yet, so it's safe to drop rather than leave a confusing
-- near-duplicate key around.
delete from public.permissions where key = 'automation.manage';

insert into public.permissions (key, description) values
  ('segments.view', 'View customer segments'),
  ('duplicates.view', 'View duplicate customer candidates'),
  ('duplicates.merge', 'Merge duplicate customers'),
  ('automations.view', 'View automation rules and executions'),
  ('automations.manage', 'Create, edit, enable/disable automation rules'),
  ('scores.configure', 'Configure customer scoring rules and thresholds'),
  ('risk.configure', 'Configure risk analysis thresholds'),
  ('notifications.view', 'View internal notifications')
on conflict (key) do nothing;

-- admin: everything new
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.key in (
  'segments.view', 'duplicates.view', 'duplicates.merge', 'automations.view',
  'automations.manage', 'scores.configure', 'risk.configure', 'notifications.view'
)
where r.name = 'admin'
on conflict do nothing;

-- manager: everything except tuning scoring/risk weights (admin-only)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.key in ('segments.view', 'duplicates.view', 'duplicates.merge', 'automations.view', 'automations.manage', 'notifications.view')
where r.name = 'manager'
on conflict do nothing;

-- supervisor: visibility + duplicate review, no automation authoring
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.key in ('segments.view', 'duplicates.view', 'duplicates.merge', 'automations.view', 'notifications.view')
where r.name = 'supervisor'
on conflict do nothing;

-- marketing: already has segments.manage from Phase 1; add view-level access to the rest
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.key in ('segments.view', 'notifications.view')
where r.name = 'marketing'
on conflict do nothing;

-- employee/support: just their own notifications
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.key = 'notifications.view'
where r.name in ('employee', 'support')
on conflict do nothing;
