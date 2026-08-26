create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  assigned_to uuid references public.profiles(id),
  type text not null default 'general',   -- call | whatsapp | general
  due_date timestamptz not null,
  priority text not null default 'medium', -- low | medium | high
  status text not null default 'pending',  -- pending | completed | overdue | cancelled
  notes text,
  created_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_follow_ups_customer_id on public.follow_ups(customer_id);
create index idx_follow_ups_assigned_to on public.follow_ups(assigned_to, status);
create index idx_follow_ups_due_date on public.follow_ups(due_date);
