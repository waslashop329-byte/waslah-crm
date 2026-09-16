-- User requested removal of the leftover "mock" provider seed data
-- (MOCK-ORD-9001/9002 and their customers) now that real orders are
-- flowing in live from the EasyOrders webhook integration.
--
-- Precise, not a blanket wipe: only removes orders/customers that actually
-- came from the mock provider. A customer who ALSO has data from another
-- source keeps that other data — only the mock contribution is removed.
-- Relies on existing ON DELETE CASCADE foreign keys to clean up phones,
-- addresses, tags, notes, events, follow-ups, score history, risk profiles,
-- etc. once a customer row is deleted.
--
-- Run this once, top to bottom, via Supabase Dashboard -> SQL Editor.

-- 1) Capture which customers came from the mock provider, before removing anything.
create temporary table mock_customer_ids as
select distinct customer_id from public.customer_external_ids where source = 'mock';

-- 2) Delete all orders synced from the mock provider (cascades to order_items).
delete from public.orders where source = 'mock';

-- 3) Delete the mock external-id links.
delete from public.customer_external_ids where source = 'mock';

-- 4) Of the customers that came from mock, delete only the ones that now
--    have nothing left from any other source.
delete from public.customers
where id in (
  select m.customer_id from mock_customer_ids m
  where not exists (select 1 from public.orders o where o.customer_id = m.customer_id)
    and not exists (select 1 from public.customer_external_ids e where e.customer_id = m.customer_id)
);

drop table mock_customer_ids;

-- 5) Remove any sync history tied to the mock provider.
delete from public.sync_run_items where sync_run_id in (select id from public.sync_runs where source = 'mock');
delete from public.sync_runs where source = 'mock';
