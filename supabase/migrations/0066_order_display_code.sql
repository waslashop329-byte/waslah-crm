-- Found live: the Confirmation queue and Orders list show orders by
-- external_order_id, an opaque internal id from the source system
-- (e.g. "cmst3ag2m0089o701lf5ytdsl") — meaningless to the merchant's own
-- team, who recognize their orders by a real order code/number instead.
-- Adds a separate column to hold that human-readable code when a source
-- provides one (main_system's raw.code); NULL for sources that don't
-- (mock, excel_import), where the UI falls back to external_order_id.
alter table public.orders add column external_order_code text;
