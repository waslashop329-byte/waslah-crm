insert into public.permissions (key, description) values
  ('profit.view', 'View profit, CAC, and customer-profitability figures')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'profit.view'
where r.name in ('admin', 'manager')
on conflict do nothing;
