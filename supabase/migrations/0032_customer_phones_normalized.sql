-- Part 3 requires keeping the original phone as received AND a normalized form
-- for matching. `phone` stays exactly as entered/received; `phone_normalized`
-- is what customer matching and search actually compare against.
alter table public.customer_phones add column phone_normalized text;

create index idx_customer_phones_phone_normalized on public.customer_phones(phone_normalized);

-- Backfill: seed data phones are already in a normalizable +20 format.
update public.customer_phones set phone_normalized = phone where phone_normalized is null;
