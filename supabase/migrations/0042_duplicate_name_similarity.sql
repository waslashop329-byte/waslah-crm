-- Fuzzy name matching for duplicate detection (Part 4). Uses the `%` pg_trgm
-- operator (not a plain similarity() filter) so the join can actually use
-- idx_customers_full_name_trgm (migration 0004) instead of a full cross scan
-- — this is what keeps the scan viable at customer-base scale (Part 19).
create or replace function public.find_similar_customer_names(similarity_threshold real default 0.35)
returns table (customer_id_a uuid, customer_id_b uuid, name_similarity real)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, b.id, similarity(a.full_name, b.full_name)
  from public.customers a
  join public.customers b
    on a.id < b.id
    and a.full_name % b.full_name
  where a.deleted_at is null
    and b.deleted_at is null
    and similarity(a.full_name, b.full_name) >= similarity_threshold
  order by 3 desc
  limit 500;
$$;
