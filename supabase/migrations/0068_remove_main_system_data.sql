-- User requested full removal of the main_system integration ("Waslah Ops
-- System") and everything it synced, after deciding to step back from real
-- data and move to Easy Order later.
--
-- Precise, not a blanket wipe: only removes orders/customers that actually
-- came from main_system. A customer who ALSO has data from another source
-- (e.g. excel_import) keeps that other data — only main_system's
-- contribution is removed. Relies on existing ON DELETE CASCADE foreign
-- keys to clean up phones, addresses, tags, notes, events, follow-ups,
-- score history, risk profiles, etc. once a customer row is deleted.
--
-- Run this once, top to bottom, via Supabase Dashboard -> SQL Editor.

-- 1) Capture which customers came from main_system, before removing anything.
create temporary table main_system_customer_ids as
select distinct customer_id from public.customer_external_ids where source = 'main_system';

-- 2) Delete all orders synced from main_system (cascades to order_items).
delete from public.orders where source = 'main_system';

-- 3) Delete the main_system external-id links.
delete from public.customer_external_ids where source = 'main_system';

-- 4) Of the customers that came from main_system, delete only the ones that
--    now have nothing left from any other source — a customer who also
--    exists via excel_import keeps their excel_import history intact.
delete from public.customers
where id in (
  select m.customer_id from main_system_customer_ids m
  where not exists (select 1 from public.orders o where o.customer_id = m.customer_id)
    and not exists (select 1 from public.customer_external_ids e where e.customer_id = m.customer_id)
);

drop table main_system_customer_ids;

-- 5) Remove sync history and configuration tied to main_system.
delete from public.sync_run_items where sync_run_id in (select id from public.sync_runs where source = 'main_system');
delete from public.sync_runs where source = 'main_system';
delete from public.external_status_mappings where source = 'main_system';
delete from public.integrations where provider = 'main_system';
