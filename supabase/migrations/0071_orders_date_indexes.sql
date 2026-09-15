-- Preparing for a real bulk historical import (Easy Order, ~700 orders/day
-- for a year — ~255,000 orders, roughly 20x the scale that already caused
-- dashboard statement timeouts once this session at ~11,000 customers).
--
-- orders.ordered_at had NO index at all, despite being filtered by nearly
-- every dashboard/report query that windows by date (getRevenueDeliveryStats,
-- getBusinessProfitSnapshot, getMarketingMetrics's CAC window, the /orders
-- page's date-range filter) — every one of those was a full sequential scan
-- over the whole orders table. At current scale that's merely wasteful; at
-- ~255,000 rows it's exactly the kind of query that starts timing out under
-- concurrent dashboard load, the same failure mode already found twice this
-- session (customer_events, the customer-count queries).
create index idx_orders_ordered_at on public.orders(ordered_at desc);

-- Most of those same queries filter status AND a date range together
-- (e.g. status = 'delivered' AND ordered_at >= since) — a composite index
-- serves that directly instead of relying on the planner to intersect two
-- separate single-column indexes.
create index idx_orders_status_ordered_at on public.orders(status, ordered_at desc);

-- The VIP / High Value dashboard tag-counts look up customer_tags by a
-- specific tag_id (after resolving the tag name), but the only existing
-- index on customer_tags leads with customer_id, not tag_id — fine for
-- "this customer's tags", not for "everyone with this tag". Matters more
-- as the customer base (and tag assignment count) grows with real import
-- volume.
create index idx_customer_tags_tag_id on public.customer_tags(tag_id) where removed_at is null;
