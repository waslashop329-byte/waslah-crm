-- Phase 7: order assignment to a confirmation agent (independent of which
-- employee the *customer* is assigned to — a confirmation team works
-- order-by-order, not customer-by-customer) + a call-attempt log that feeds
-- Confirmation/Contact Rate and can transition the order's status itself.

alter table public.orders add column assigned_to uuid references public.profiles(id);
create index idx_orders_assigned_to on public.orders(assigned_to, status);

-- Same dual-scoping shape already used by follow_ups' RLS policy: visible if
-- the order itself is assigned to you, OR its customer is (whichever access
-- path applies), OR you're full-access.
drop policy "orders_all" on public.orders;
create policy "orders_all" on public.orders for all to authenticated
  using (
    public.is_full_access()
    or assigned_to = auth.uid()
    or exists (select 1 from public.customers c where c.id = customer_id and c.assigned_to = auth.uid())
  );

create table public.order_call_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  agent_id uuid not null references public.profiles(id),
  result text not null, -- no_answer | confirmed | cancelled | reschedule | invalid_number
  notes text,
  attempted_at timestamptz not null default now()
);

create index idx_order_call_attempts_order_id on public.order_call_attempts(order_id);
create index idx_order_call_attempts_agent_id on public.order_call_attempts(agent_id, attempted_at desc);

alter table public.order_call_attempts enable row level security;
create policy "order_call_attempts_all" on public.order_call_attempts for all to authenticated
  using (exists (
    select 1 from public.orders o where o.id = order_id and (
      public.is_full_access() or o.assigned_to = auth.uid()
      or exists (select 1 from public.customers c where c.id = o.customer_id and c.assigned_to = auth.uid())
    )
  ));
