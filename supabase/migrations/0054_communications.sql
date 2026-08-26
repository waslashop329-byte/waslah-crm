-- Phase 9: outbound message log (WhatsApp/SMS). No real messaging provider is
-- connected yet — lib/messaging/providers/mock-provider.ts stands in until
-- one is, same "mock now, swap the provider later" shape as the AI and
-- integration-sync layers. Every send here — whether a human clicked "Send
-- Message" or an automation rule fired — also gets a matching customer_events
-- row (Part 9's "one unified timeline", not a separate comms-only view).
create table public.communications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  channel text not null, -- whatsapp | sms
  direction text not null default 'outbound', -- outbound | inbound (inbound unused until a real provider can receive webhooks)
  body text not null,
  status text not null, -- sent | failed
  provider text not null,
  provider_message_id text,
  error text,
  related_order_id uuid references public.orders(id) on delete set null,
  sent_by uuid references public.profiles(id), -- null = automation, not a person
  created_at timestamptz not null default now()
);

create index idx_communications_customer_id on public.communications(customer_id, created_at desc);

alter table public.communications enable row level security;
create policy "communications_all" on public.communications for all to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));

insert into public.permissions (key, description) values
  ('communications.send', 'Send a WhatsApp/SMS message to a customer')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'communications.send'
where r.name in ('admin', 'manager', 'supervisor', 'employee', 'support')
on conflict do nothing;
