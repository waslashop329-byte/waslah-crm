-- Phase 17 (growth roadmap, final item): Membership + Offers + Coupons —
-- an extension of the existing Loyalty Tiers system (Phase 11), not a
-- separate paid-membership program, per the user's own choice. Per-tier
-- perks already exist (loyalty_tiers.benefits, editable in Settings) — the
-- genuinely new pieces are time-boxed offers and redeemable coupon codes.
--
-- Neither table auto-applies anything at checkout — this CRM has no live
-- storefront checkout to hook into (orders arrive via sync/webhook from the
-- external ops system). Offers are a promotion calendar/visibility tool;
-- coupon redemption is logged manually (an agent applying a code during a
-- COD phone confirmation, same "manual now, real integration later" pattern
-- as ad_cost/shipping_cost).

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  loyalty_tier_id uuid references public.loyalty_tiers(id) on delete set null,
  segment_id uuid references public.segments(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_offers_updated_at before update on public.offers for each row execute function public.set_updated_at();
create index idx_offers_active_window on public.offers(is_active, starts_at, ends_at);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  discount_type text not null, -- 'percentage' | 'fixed'
  discount_value numeric(10,2) not null,
  loyalty_tier_id uuid references public.loyalty_tiers(id) on delete set null,
  segment_id uuid references public.segments(id) on delete set null,
  usage_limit integer, -- null = unlimited
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_coupons_code on public.coupons(upper(code));
create trigger trg_coupons_updated_at before update on public.coupons for each row execute function public.set_updated_at();

-- Immutable log, same "never delete history" principle as order_call_attempts —
-- a redemption is a fact that happened, not editable/removable state.
create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  related_order_id uuid references public.orders(id) on delete set null,
  redeemed_by uuid references public.profiles(id),
  redeemed_at timestamptz not null default now()
);

create index idx_coupon_redemptions_coupon_id on public.coupon_redemptions(coupon_id);

alter table public.offers enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

create policy "offers_select" on public.offers for select to authenticated using (true);
create policy "offers_write" on public.offers for all to authenticated
  using (public.is_full_access() or public.current_user_role() = 'marketing')
  with check (public.is_full_access() or public.current_user_role() = 'marketing');

create policy "coupons_select" on public.coupons for select to authenticated using (true);
create policy "coupons_write" on public.coupons for all to authenticated
  using (public.is_full_access() or public.current_user_role() = 'marketing')
  with check (public.is_full_access() or public.current_user_role() = 'marketing');

-- Redemption logging is broader than offers/coupons management — any
-- confirmation-facing role can record "customer used this code", same
-- reasoning as complaints.manage being granted broadly (orders.confirm tier).
create policy "coupon_redemptions_select" on public.coupon_redemptions for select to authenticated using (true);
create policy "coupon_redemptions_insert" on public.coupon_redemptions for insert to authenticated with check (true);

insert into public.permissions (key, description) values
  ('promotions.manage', 'Create and manage loyalty offers and coupon codes'),
  ('promotions.redeem', 'Log a coupon redemption against a customer')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key in ('promotions.manage', 'promotions.redeem')
where r.name in ('admin', 'manager', 'marketing')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r join public.permissions p on p.key = 'promotions.redeem'
where r.name in ('supervisor', 'employee', 'support')
on conflict do nothing;
