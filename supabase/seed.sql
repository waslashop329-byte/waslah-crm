-- DEV-ONLY seed data. Realistic but fabricated — never point this at production.
-- Run via `supabase db reset` (applies all migrations, then this file).

-- ============ Roles ============
insert into public.roles (name, description, is_system) values
  ('admin', 'Full access to every module and configuration', true),
  ('manager', 'Full visibility into customers and reporting, cannot change system configuration', true),
  ('supervisor', 'Full visibility into customers, manages team follow-ups', true),
  ('employee', 'Sees only customers assigned to them', true),
  ('marketing', 'Segments, tags and campaign-facing data', true),
  ('support', 'Customer profile, notes and follow-ups for assigned customers', true);

-- ============ Permissions (representative set; expand as modules ship) ============
insert into public.permissions (key, description) values
  ('customers.view_all', 'View every customer, not just assigned ones'),
  ('customers.edit', 'Edit customer profile fields'),
  ('customers.merge', 'Merge duplicate customers'),
  ('follow_ups.manage_all', 'Manage follow-ups for any customer'),
  ('segments.manage', 'Create and edit segments'),
  ('tags.manage', 'Create and edit tags'),
  ('integrations.manage', 'Configure integrations and view sync logs'),
  ('automation.manage', 'Create and edit automation rules'),
  ('audit_logs.view', 'View the audit log'),
  ('ai.manage', 'Configure AI features and approve AI tag suggestions'),
  ('users.manage', 'Manage CRM users and role assignments');

-- admin: everything
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p where r.name = 'admin';

-- manager: everything except user/role management
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name = 'manager' and p.key <> 'users.manage';

-- supervisor: customer + follow-up + tag operations
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name = 'supervisor' and p.key in ('customers.view_all', 'customers.edit', 'follow_ups.manage_all', 'tags.manage');

-- marketing: segments + tags
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.name = 'marketing' and p.key in ('segments.manage', 'tags.manage', 'customers.view_all');

-- employee/support: no elevated permissions (RLS scopes them to assigned customers)

-- ============ Scoring rules (weights are illustrative starting values) ============
insert into public.scoring_rules (key, label, weight) values
  ('delivered_order', 'Successfully delivered order', 8),
  ('repeat_purchase', 'Repeat purchase (2nd+ order)', 5),
  ('recent_activity_30d', 'Ordered within the last 30 days', 6),
  ('high_total_value', 'Total spend above the high-value threshold', 10),
  ('cancelled_order', 'Cancelled order', -10),
  ('returned_order', 'Returned order', -8),
  ('refused_shipment', 'Refused shipment on delivery', -15);

-- ============ Tags ============
insert into public.tags (name, color) values
  ('VIP', '#a855f7'),
  ('Retention', '#3b82f6'),
  ('Trusted Customer', '#22c55e'),
  ('High Risk', '#ef4444'),
  ('High Cancellation Risk', '#f97316'),
  ('High Value', '#eab308'),
  ('Inactive', '#6b7280'),
  ('Potential Upsell', '#14b8a6');

-- ============ One dev admin user (email: admin@dev.local / password: DevPassword123!) ============
-- confirmation_token/recovery_token/email_change/email_change_token_new are
-- forced to '' (not left NULL, the column default) because GoTrue scans them
-- as plain strings in some code paths — a NULL there makes password sign-in
-- fail silently for any user inserted directly via SQL instead of the Auth API.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@dev.local',
  crypt('DevPassword123!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Dev Admin"}',
  '', '', '', ''
);

-- the handle_new_user trigger just created a profile with the default 'employee' role; promote it.
update public.profiles
set role_id = (select id from public.roles where name = 'admin')
where email = 'admin@dev.local';

-- ============ Sample customers ============
with new_customers as (
  insert into public.customers (
    full_name, email, status, source, customer_since,
    total_orders, delivered_orders, cancelled_orders, returned_orders,
    total_spend, avg_order_value, first_order_at, last_order_at,
    score, score_category
  ) values
    ('Mona Abdel Fattah', 'mona.af@example.com', 'active', 'main_system', now() - interval '14 months',
      9, 8, 1, 0, 18400.00, 2044.44, now() - interval '13 months', now() - interval '5 days', 88, 'excellent'),
    ('Ahmed Zaki', 'ahmed.zaki@example.com', 'active', 'main_system', now() - interval '9 months',
      5, 3, 2, 0, 4200.00, 840.00, now() - interval '9 months', now() - interval '40 days', 52, 'medium_risk'),
    ('Salma Hossam', 'salma.hossam@example.com', 'active', 'main_system', now() - interval '20 months',
      14, 13, 1, 0, 31200.00, 2228.57, now() - interval '19 months', now() - interval '2 days', 95, 'excellent'),
    ('Youssef Nabil', null, 'active', 'main_system', now() - interval '3 months',
      2, 0, 2, 0, 0.00, 0.00, now() - interval '3 months', now() - interval '70 days', 18, 'high_risk'),
    ('Nour El-Din Mostafa', 'nour.mostafa@example.com', 'active', 'main_system', now() - interval '6 months',
      4, 4, 0, 0, 6800.00, 1700.00, now() - interval '6 months', now() - interval '12 days', 76, 'trusted'),
    ('Heba Karim', 'heba.karim@example.com', 'inactive', 'main_system', now() - interval '11 months',
      3, 3, 0, 0, 2100.00, 700.00, now() - interval '11 months', now() - interval '95 days', 61, 'trusted'),
    ('Omar Farouk', null, 'active', 'main_system', now() - interval '2 months',
      1, 1, 0, 0, 950.00, 950.00, now() - interval '2 months', now() - interval '2 months', 55, 'medium_risk'),
    ('Rania Adel', 'rania.adel@example.com', 'active', 'main_system', now() - interval '17 months',
      11, 9, 1, 1, 15600.00, 1733.33, now() - interval '16 months', now() - interval '8 days', 79, 'trusted'),
    ('Karim Sabry', null, 'active', 'main_system', now() - interval '4 months',
      3, 1, 2, 0, 800.00, 266.67, now() - interval '4 months', now() - interval '25 days', 30, 'high_risk'),
    ('Dina Fathy', 'dina.fathy@example.com', 'active', 'main_system', now() - interval '8 months',
      6, 6, 0, 0, 9600.00, 1600.00, now() - interval '8 months', now() - interval '3 days', 84, 'excellent')
  returning id, full_name
)
select * from new_customers;

-- Phones (one primary each, using deterministic Egyptian mobile numbers for dev only)
insert into public.customer_phones (customer_id, phone, is_primary)
select c.id, p.phone, true
from public.customers c
join (values
  ('Mona Abdel Fattah', '+201012345001'),
  ('Ahmed Zaki', '+201012345002'),
  ('Salma Hossam', '+201012345003'),
  ('Youssef Nabil', '+201012345004'),
  ('Nour El-Din Mostafa', '+201012345005'),
  ('Heba Karim', '+201012345006'),
  ('Omar Farouk', '+201012345007'),
  ('Rania Adel', '+201012345008'),
  ('Karim Sabry', '+201012345009'),
  ('Dina Fathy', '+201012345010')
) as p(full_name, phone) on p.full_name = c.full_name;

-- Addresses
insert into public.customer_addresses (customer_id, label, address_line, city, governorate, is_primary)
select c.id, 'Home', a.address_line, a.city, a.governorate, true
from public.customers c
join (values
  ('Mona Abdel Fattah', '12 Al Nasr St, Apt 4', 'Cairo', 'Cairo'),
  ('Ahmed Zaki', '5 Corniche Rd', 'Alexandria', 'Alexandria'),
  ('Salma Hossam', '8 Tahrir Square', 'Cairo', 'Cairo'),
  ('Youssef Nabil', '21 El Horreya Ave', 'Mansoura', 'Dakahlia'),
  ('Nour El-Din Mostafa', '3 Gomhoria St', 'Giza', 'Giza'),
  ('Heba Karim', '17 Abu Qir Rd', 'Alexandria', 'Alexandria'),
  ('Omar Farouk', '9 El Thawra St', 'Cairo', 'Cairo'),
  ('Rania Adel', '44 Sheikh Zayed', '6th of October', 'Giza'),
  ('Karim Sabry', '2 El Geish Rd', 'Suez', 'Suez'),
  ('Dina Fathy', '30 Ramses St', 'Cairo', 'Cairo')
) as a(full_name, address_line, city, governorate) on a.full_name = c.full_name;

-- Tags
insert into public.customer_tags (customer_id, tag_id, source)
select c.id, t.id, 'manual'
from public.customers c
join (values
  ('Mona Abdel Fattah', 'VIP'),
  ('Mona Abdel Fattah', 'Retention'),
  ('Salma Hossam', 'VIP'),
  ('Salma Hossam', 'High Value'),
  ('Youssef Nabil', 'High Risk'),
  ('Youssef Nabil', 'High Cancellation Risk'),
  ('Karim Sabry', 'High Cancellation Risk'),
  ('Heba Karim', 'Inactive'),
  ('Rania Adel', 'Trusted Customer'),
  ('Dina Fathy', 'Potential Upsell')
) as ct(full_name, tag_name) on ct.full_name = c.full_name
join public.tags t on t.name = ct.tag_name;

-- Timeline: customer.created for everyone
insert into public.customer_events (customer_id, event_type, title, description, created_at)
select id, 'customer.created', 'Customer created', 'Customer profile created from main system sync', customer_since from public.customers;

-- ============ Products (Phase 6 catalog) ============
insert into public.products (name, sku, category, default_price, cost_price) values
  ('Wireless Earbuds', 'ELEC-001', 'Electronics', 899.00, 420.00),
  ('Skincare Set', 'BEAU-001', 'Beauty', 650.00, 260.00),
  ('Men''s Sneakers', 'FASH-001', 'Fashion', 1350.00, 610.00),
  ('Kitchen Blender', 'HOME-001', 'Home', 1100.00, 520.00),
  ('Smart Watch', 'ELEC-002', 'Electronics', 2400.00, 1150.00),
  ('Perfume Bundle', 'BEAU-002', 'Beauty', 899.00, 340.00),
  ('Backpack', 'FASH-002', 'Fashion', 750.00, 300.00),
  ('Bluetooth Speaker', 'ELEC-003', 'Electronics', 1050.00, 480.00),
  ('Baby Stroller', 'BABY-001', 'Baby', 3200.00, 1600.00),
  ('Makeup Kit', 'BEAU-003', 'Beauty', 480.00, 190.00);

-- ============ Orders (local CRM cache — the future Phase 3 sync target) ============
-- Generates orders matching each customer's delivered/cancelled/returned counts,
-- spread between their first and last order date, each with a matching order.*
-- timeline event, a matching order_items line (Phase 6), and plausible ad/shipping cost.
do $$
declare
  cust record;
  prod record;
  i integer;
  order_date timestamptz;
  order_status text;
  order_amount numeric;
  delivered_left integer;
  cancelled_left integer;
  returned_left integer;
  new_order_id uuid;
begin
  for cust in select * from public.customers loop
    delivered_left := cust.delivered_orders;
    cancelled_left := cust.cancelled_orders;
    returned_left := cust.returned_orders;

    for i in 1..greatest(cust.total_orders, 0) loop
      if delivered_left > 0 then
        order_status := 'delivered';
        delivered_left := delivered_left - 1;
      elsif cancelled_left > 0 then
        order_status := 'cancelled';
        cancelled_left := cancelled_left - 1;
      elsif returned_left > 0 then
        order_status := 'returned';
        returned_left := returned_left - 1;
      else
        order_status := 'shipped';
      end if;

      order_date := cust.first_order_at + ((cust.last_order_at - cust.first_order_at) * (i::float / greatest(cust.total_orders, 1)));
      select * into prod from public.products order by random() limit 1;
      order_amount := round((cust.avg_order_value * (0.75 + random() * 0.5))::numeric, 2);

      insert into public.orders (customer_id, source, status, product_summary, total_amount, ad_cost, shipping_cost, ordered_at, delivered_at, cancelled_at, returned_at)
      values (
        cust.id,
        'mock',
        order_status,
        prod.name,
        order_amount,
        round((order_amount * (0.06 + random() * 0.08))::numeric, 2),
        round((40 + random() * 40)::numeric, 2),
        order_date,
        case when order_status = 'delivered' then order_date + interval '3 days' else null end,
        case when order_status = 'cancelled' then order_date + interval '1 days' else null end,
        case when order_status = 'returned' then order_date + interval '7 days' else null end
      )
      returning id into new_order_id;

      insert into public.order_items (order_id, product_id, product_name_raw, quantity, unit_price, unit_cost)
      values (new_order_id, prod.id, prod.name, 1, order_amount, prod.cost_price);

      insert into public.customer_events (customer_id, event_type, title, description, related_order_id, created_at)
      values (
        cust.id,
        'order.' || order_status,
        initcap(order_status) || ' order',
        'Order ' || order_status,
        new_order_id::text,
        order_date
      );
    end loop;
  end loop;
end $$;

-- ============ Fresh pending orders (Phase 7 confirmation demo data) ============
-- The generator above only produces already-resolved statuses (delivered/
-- cancelled/returned/shipped) — Today's Mission and Unassigned Orders need
-- some genuinely new/pending orders to have anything to show.
do $$
declare
  cust record;
  prod record;
  new_order_id uuid;
  admin_id uuid;
  i integer := 0;
begin
  select id into admin_id from public.profiles where email = 'admin@dev.local';

  for cust in select * from public.customers order by customer_since limit 6 loop
    select * into prod from public.products order by random() limit 1;
    i := i + 1;

    insert into public.orders (customer_id, source, status, product_summary, total_amount, ad_cost, shipping_cost, assigned_to, ordered_at)
    values (
      cust.id,
      'mock',
      'pending',
      prod.name,
      round((cust.avg_order_value * (0.75 + random() * 0.5))::numeric, 2),
      null,
      null,
      case when i % 2 = 0 then admin_id else null end,
      now() - (i || ' hours')::interval
    )
    returning id into new_order_id;

    insert into public.order_items (order_id, product_id, product_name_raw, quantity, unit_price, unit_cost)
    values (new_order_id, prod.id, prod.name, 1, round((cust.avg_order_value * (0.75 + random() * 0.5))::numeric, 2), prod.cost_price);

    insert into public.customer_events (customer_id, event_type, title, description, related_order_id, created_at)
    values (cust.id, 'order.pending', 'Order placed', 'Awaiting confirmation', new_order_id::text, now() - (i || ' hours')::interval);
  end loop;
end $$;

-- Notes
insert into public.customer_notes (customer_id, author_id, content, created_at)
select c.id, p.id, 'Customer prefers WhatsApp over phone calls.', now() - interval '10 days'
from public.customers c, (select id from public.profiles where email = 'admin@dev.local') p
where c.full_name in ('Mona Abdel Fattah', 'Salma Hossam');

insert into public.customer_events (customer_id, event_type, title, description, created_at)
select c.id, 'note.created', 'Note added', 'Customer prefers WhatsApp over phone calls.', now() - interval '10 days'
from public.customers c where c.full_name in ('Mona Abdel Fattah', 'Salma Hossam');

-- Follow-ups (overdue is computed dynamically from due_date, never stored)
insert into public.follow_ups (customer_id, assigned_to, type, title, due_date, priority, status, notes, created_by)
select c.id, p.id, 'call', 'Check in after cancellation', now() + interval '2 days', 'high', 'pending', 'Check in after last cancellation', p.id
from public.customers c, (select id from public.profiles where email = 'admin@dev.local') p
where c.full_name = 'Youssef Nabil';

insert into public.follow_ups (customer_id, assigned_to, type, title, due_date, priority, status, notes, created_by)
select c.id, p.id, 'whatsapp', 'Send reactivation offer', now() - interval '3 days', 'medium', 'pending', 'Send reactivation offer', p.id
from public.customers c, (select id from public.profiles where email = 'admin@dev.local') p
where c.full_name = 'Heba Karim';

-- Score history
insert into public.score_history (customer_id, score, category, reason)
select id, score, score_category, 'Initial score from seed data' from public.customers;

-- Segments (system segments — protected from deletion, see is_system below)
insert into public.segments (name, description, is_dynamic, is_system) values
  ('VIP Customers', 'Customers tagged VIP', true, true),
  ('High Cancellation Risk', 'Customers whose cancellation risk is High', true, true),
  ('Inactive 90 Days', 'No order in the last 90 days', true, true);

-- Rule format matches lib/intelligence/segments/segment-schema.ts: {operator, conditions[]}.
insert into public.segment_rules (segment_id, conditions)
select id, '{"operator":"AND","conditions":[{"field":"tag","operator":"contains","value":"VIP"}]}'::jsonb
from public.segments where name = 'VIP Customers';

-- Uses the real risk category from customer_risk_profiles (Phase 4 Step 3) rather than
-- a raw field-to-field comparison, which the segment engine intentionally doesn't support
-- (every condition compares one field to a literal value, never to another field).
insert into public.segment_rules (segment_id, conditions)
select id, '{"operator":"AND","conditions":[{"field":"cancellation_risk_category","operator":"equals","value":"high"}]}'::jsonb
from public.segments where name = 'High Cancellation Risk';

insert into public.segment_rules (segment_id, conditions)
select id, '{"operator":"AND","conditions":[{"field":"last_order_at","operator":"days_since_greater_than","value":90}]}'::jsonb
from public.segments where name = 'Inactive 90 Days';

-- ============ Customer acquisition (Phase 8 marketing attribution demo) ============
insert into public.customer_acquisition (customer_id, source, medium, campaign, first_touch_at)
select c.id, a.source, a.medium, a.campaign, c.customer_since
from public.customers c
join (values
  ('Mona Abdel Fattah', 'facebook', 'cpc', 'Ramadan Bundle'),
  ('Ahmed Zaki', 'tiktok', 'video', 'Winter Launch'),
  ('Salma Hossam', 'facebook', 'cpc', 'Ramadan Bundle'),
  ('Youssef Nabil', 'google', 'cpc', 'Search Brand'),
  ('Nour El-Din Mostafa', 'organic', 'none', null),
  ('Heba Karim', 'facebook', 'cpc', 'Retargeting Q2'),
  ('Omar Farouk', 'tiktok', 'video', 'Winter Launch'),
  ('Rania Adel', 'google', 'cpc', 'Search Brand'),
  ('Karim Sabry', 'tiktok', 'video', 'Winter Launch'),
  ('Dina Fathy', 'organic', 'none', null)
) as a(full_name, source, medium, campaign) on a.full_name = c.full_name;

-- ============ Mock integration (dev/architecture testing — see lib/integrations/adapters/mock) ============
insert into public.integrations (name, provider, type, capabilities, config, is_active, status)
values (
  'Mock Operations System',
  'mock',
  'rest',
  '["fetchCustomers", "fetchOrders", "fetchUpdatedOrders"]'::jsonb,
  '{}'::jsonb,
  true,
  'connected'
);

-- Example status mappings for the mock provider's made-up vocabulary.
insert into public.external_status_mappings (source, external_status, internal_status) values
  ('mock', 'NEW', 'new'),
  ('mock', 'AWAITING_CONFIRMATION', 'pending'),
  ('mock', 'CONFIRMED', 'confirmed'),
  ('mock', 'PACKED', 'processing'),
  ('mock', 'OUT_FOR_DELIVERY', 'shipped'),
  ('mock', 'DELIVERED', 'delivered'),
  ('mock', 'CUSTOMER_CANCELLED', 'cancelled'),
  ('mock', 'RETURNED_TO_WAREHOUSE', 'returned'),
  ('mock', 'DELIVERY_FAILED', 'failed_delivery');

-- Mock external ids, as if every seed customer had already been synced once from the mock provider.
insert into public.customer_external_ids (customer_id, source, external_id)
select c.id, 'mock', 'MOCK-CUST-' || lpad((row_number() over (order by c.customer_since))::text, 4, '0')
from public.customers c;

-- ============ AI model pricing (Phase 5) — configurable, not hardcoded in app code ============
insert into public.ai_model_pricing (provider, model, input_price_per_1k, output_price_per_1k) values
  ('openai', 'gpt-4o-mini', 0.00015, 0.0006),
  ('openai', 'gpt-4o', 0.0025, 0.01),
  ('mock', 'mock-model', 0, 0);
