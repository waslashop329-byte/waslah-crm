-- Phase 1 seeded a placeholder 'ai.manage' key before any AI feature existed;
-- Phase 5 replaces it with the granular set Part 22 actually asks for.
delete from public.permissions where key = 'ai.manage';

insert into public.permissions (key, description) values
  ('ai.summary.view', 'View AI-generated customer summaries'),
  ('ai.summary.generate', 'Generate or regenerate an AI customer summary'),
  ('ai.insights.view', 'View AI business insights'),
  ('ai.assistant.use', 'Use the AI CRM assistant'),
  ('ai.suggestions.approve', 'Approve or reject AI suggestions (tags, follow-ups, merges)'),
  ('ai.usage.view', 'View AI usage and cost dashboards'),
  ('ai.settings.manage', 'Configure AI provider and model pricing')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.key in (
  'ai.summary.view', 'ai.summary.generate', 'ai.insights.view', 'ai.assistant.use',
  'ai.suggestions.approve', 'ai.usage.view', 'ai.settings.manage'
)
where r.name = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.key in ('ai.summary.view', 'ai.summary.generate', 'ai.insights.view', 'ai.assistant.use', 'ai.suggestions.approve', 'ai.usage.view')
where r.name = 'manager'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.key in ('ai.summary.view', 'ai.summary.generate', 'ai.insights.view', 'ai.assistant.use', 'ai.suggestions.approve')
where r.name = 'supervisor'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r
join public.permissions p on p.key in ('ai.summary.view', 'ai.summary.generate', 'ai.assistant.use')
where r.name in ('employee', 'support', 'marketing')
on conflict do nothing;
