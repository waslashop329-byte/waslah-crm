-- Keeps external status strings out of application code (Part 6): each source
-- defines its own vocabulary, mapped once here to the internal order status.
create table public.external_status_mappings (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_status text not null,
  internal_status text not null, -- new | pending | confirmed | processing | shipped | delivered | cancelled | returned | failed_delivery
  created_at timestamptz not null default now()
);

create unique index idx_external_status_mappings_source_status on public.external_status_mappings(source, external_status);

alter table public.external_status_mappings enable row level security;

create policy "external_status_mappings_select" on public.external_status_mappings for select to authenticated using (true);
create policy "external_status_mappings_write" on public.external_status_mappings for all to authenticated
  using (public.is_full_access()) with check (public.is_full_access());
