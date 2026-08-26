insert into public.permissions (key, description) values
  ('orders.assign', 'Assign orders to a confirmation agent'),
  ('orders.confirm', 'Log call attempts against assigned orders')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in ('orders.assign', 'orders.confirm')
where r.name in ('admin', 'manager', 'supervisor')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'orders.confirm'
where r.name in ('employee', 'support')
on conflict do nothing;
