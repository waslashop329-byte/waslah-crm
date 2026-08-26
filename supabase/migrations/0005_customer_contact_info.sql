create table public.customer_phones (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  phone text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_customer_phones_customer_id on public.customer_phones(customer_id);
create index idx_customer_phones_phone on public.customer_phones(phone);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text,
  address_line text not null,
  city text,
  governorate text,
  country text not null default 'EG',
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_customer_addresses_customer_id on public.customer_addresses(customer_id);
