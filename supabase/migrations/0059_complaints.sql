-- Phase 12: Complaints/Support — Part 9's "not sales-only" ask. Customer ->
-- Order -> Complaint -> Resolution, same relational shape as follow_ups.
create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  type text not null, -- complaint | inquiry | product_issue | shipping_issue | refund_request | replacement_request | warranty
  status text not null default 'open', -- open | in_progress | resolved | closed
  subject text not null,
  description text,
  resolution_notes text,
  assigned_to uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_complaints_customer_id on public.complaints(customer_id, created_at desc);
create index idx_complaints_status on public.complaints(status);

create trigger trg_complaints_updated_at before update on public.complaints for each row execute function public.set_updated_at();

alter table public.complaints enable row level security;
create policy "complaints_all" on public.complaints for all to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));

insert into public.permissions (key, description) values
  ('complaints.manage', 'Log and update customer complaints, inquiries, and refund/replacement requests')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'complaints.manage'
where r.name in ('admin', 'manager', 'supervisor', 'employee', 'support')
on conflict do nothing;
