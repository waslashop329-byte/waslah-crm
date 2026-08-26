-- Phase 8: marketing attribution. No real ads integration exists yet, so this
-- is manually tagged per customer (Part 7's Campaign/Ad/UTM linkage) rather
-- than synced — a separate table, not columns on customers, so a future
-- multi-touch model can extend it without another migration.
create table public.customer_acquisition (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  source text, -- e.g. facebook | tiktok | google | organic
  medium text,
  campaign text,
  content text,
  landing_page text,
  first_touch_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_customer_acquisition_source on public.customer_acquisition(source);
create trigger trg_customer_acquisition_updated_at before update on public.customer_acquisition for each row execute function public.set_updated_at();

alter table public.customer_acquisition enable row level security;
create policy "customer_acquisition_all" on public.customer_acquisition for all to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));
