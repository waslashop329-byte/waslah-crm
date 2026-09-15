-- User requested a full clean slate: wipe ALL customers and orders,
-- including the excel_import data (not scoped to one source this time) —
-- going back to testing with fake/mock data only.
--
-- TRUNCATE ... CASCADE follows every foreign key that points at customers,
-- directly or transitively — orders, order_items, phones, addresses, tags,
-- notes, events, follow-ups, score history, risk profiles, complaints,
-- communications, campaign enrollments, coupon redemptions, duplicate
-- candidates, customer_external_ids, customer_acquisition, etc. — without
-- needing to enumerate every one by hand. Tables that don't reference
-- customers (products, segments, campaigns, promotions, automation rules,
-- scoring/loyalty config, integrations) are left untouched.
--
-- Run this once, via Supabase Dashboard -> SQL Editor.
truncate table public.customers cascade;

-- Sync history/logs no longer describe anything real once the underlying
-- data is gone — truncating sync_runs cascades to sync_run_items too.
truncate table public.sync_runs cascade;
