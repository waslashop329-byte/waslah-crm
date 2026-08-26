insert into public.permissions (key, description) values
  ('products.manage', 'Create, edit, and deactivate products in the catalog'),
  ('orders.manage_costs', 'Edit ad spend, shipping cost, and line items on an order')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in ('products.manage', 'orders.manage_costs')
where r.name = 'admin'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in ('products.manage', 'orders.manage_costs')
where r.name = 'manager'
on conflict do nothing;
