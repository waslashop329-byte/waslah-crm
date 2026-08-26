-- Phase 6: product catalog + order line items + order-level cost fields.
-- Additive only — orders.product_summary stays as the sync/display fallback;
-- order_items is the new structured breakdown, populated manually via the
-- catalog UI or (best-effort, on first sync only) by the integration engine
-- via external_product_mappings below.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  category text,
  default_price numeric(14,2) not null default 0,
  -- Nullable: not every product has a known cost yet, and an unknown cost
  -- must mean "profit can't be computed", never silently treated as zero.
  cost_price numeric(14,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_products_sku on public.products(sku) where sku is not null;
create index idx_products_active on public.products(is_active);
create trigger trg_products_updated_at before update on public.products for each row execute function public.set_updated_at();

alter table public.products enable row level security;
create policy "products_select" on public.products for select to authenticated using (true);
create policy "products_write" on public.products for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

-- unit_price/unit_cost are snapshots at time of sale so later catalog price
-- changes never rewrite historical profit — same "recompute, never drift"
-- principle used by recalculateCustomerStats().
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name_raw text not null,
  quantity integer not null default 1,
  unit_price numeric(14,2) not null default 0,
  unit_cost numeric(14,2),
  created_at timestamptz not null default now()
);

create index idx_order_items_order_id on public.order_items(order_id);
create index idx_order_items_product_id on public.order_items(product_id) where product_id is not null;

alter table public.order_items enable row level security;
create policy "order_items_all" on public.order_items for all to authenticated
  using (exists (
    select 1 from public.orders o join public.customers c on c.id = o.customer_id
    where o.id = order_id and (public.is_full_access() or c.assigned_to = auth.uid())
  ));

-- Order economics: nullable because most historical/synced orders won't have
-- this — ad spend and shipping cost are entered manually until a real
-- integration can supply them.
alter table public.orders add column ad_cost numeric(14,2);
alter table public.orders add column shipping_cost numeric(14,2);

-- Mirrors external_status_mappings (Phase 3): maps a source's raw product
-- text to a local product, so the sync engine can auto-create a matched
-- order_item without guessing.
create table public.external_product_mappings (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  external_product_text text not null,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index idx_external_product_mappings_source_text on public.external_product_mappings(source, external_product_text);

alter table public.external_product_mappings enable row level security;
create policy "external_product_mappings_select" on public.external_product_mappings for select to authenticated using (true);
create policy "external_product_mappings_write" on public.external_product_mappings for all to authenticated using (public.is_full_access()) with check (public.is_full_access());
