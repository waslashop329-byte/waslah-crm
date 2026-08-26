-- Transactional customer merge (Part 6). A Postgres function is the only way
-- to get real atomicity here — the whole body runs in one transaction, so
-- any exception (a genuinely unexpected error, not the handled edge cases
-- below) rolls back every move automatically. Nothing is ever deleted: the
-- secondary customer row survives as a soft-deleted, clearly marked record,
-- and every one of its child rows is *moved* (UPDATE), never dropped.
create or replace function public.merge_customers(p_primary_id uuid, p_secondary_id uuid, p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orders_moved int;
  v_phones_moved int;
  v_addresses_moved int;
  v_notes_moved int;
  v_events_moved int;
  v_followups_moved int;
  v_tags_moved int;
  v_tags_soft_removed int;
  v_external_ids_moved int;
  v_score_history_moved int;
  v_result jsonb;
begin
  if p_primary_id = p_secondary_id then
    raise exception 'Cannot merge a customer into itself';
  end if;

  perform 1 from public.customers where id = p_primary_id and deleted_at is null for update;
  if not found then
    raise exception 'Primary customer not found or already deleted';
  end if;

  perform 1 from public.customers where id = p_secondary_id and deleted_at is null for update;
  if not found then
    raise exception 'Secondary customer not found or already merged';
  end if;

  update public.orders set customer_id = p_primary_id where customer_id = p_secondary_id;
  get diagnostics v_orders_moved = row_count;

  -- No unique constraint on phone number alone, so a straight move is safe;
  -- is_primary is reset since "primary phone" is meaningless without context.
  update public.customer_phones set customer_id = p_primary_id, is_primary = false where customer_id = p_secondary_id;
  get diagnostics v_phones_moved = row_count;

  -- Demote before moving: idx_customer_addresses_one_primary allows only one
  -- is_primary=true row per customer, and the primary customer may already have one.
  update public.customer_addresses set is_primary = false where customer_id = p_secondary_id;
  update public.customer_addresses set customer_id = p_primary_id where customer_id = p_secondary_id;
  get diagnostics v_addresses_moved = row_count;

  update public.customer_notes set customer_id = p_primary_id where customer_id = p_secondary_id;
  get diagnostics v_notes_moved = row_count;

  update public.customer_events set customer_id = p_primary_id where customer_id = p_secondary_id;
  get diagnostics v_events_moved = row_count;

  update public.follow_ups set customer_id = p_primary_id where customer_id = p_secondary_id;
  get diagnostics v_followups_moved = row_count;

  -- Tags: idx_customer_tags_active forbids two active rows for the same
  -- (customer_id, tag_id). Move only the ones the primary doesn't already
  -- actively have; anything that would collide is soft-removed instead of
  -- dropped, so the fact the secondary once had it is still visible in history.
  update public.customer_tags secondary_tag
  set customer_id = p_primary_id
  where secondary_tag.customer_id = p_secondary_id
    and secondary_tag.removed_at is null
    and not exists (
      select 1 from public.customer_tags primary_tag
      where primary_tag.customer_id = p_primary_id
        and primary_tag.tag_id = secondary_tag.tag_id
        and primary_tag.removed_at is null
    );
  get diagnostics v_tags_moved = row_count;

  update public.customer_tags
  set removed_at = now()
  where customer_id = p_secondary_id and removed_at is null;
  get diagnostics v_tags_soft_removed = row_count;

  -- External ids are the whole point of "preserve source references" — always moved, never dropped.
  update public.customer_external_ids set customer_id = p_primary_id where customer_id = p_secondary_id;
  get diagnostics v_external_ids_moved = row_count;

  update public.score_history set customer_id = p_primary_id where customer_id = p_secondary_id;
  get diagnostics v_score_history_moved = row_count;

  update public.customers
  set status = 'merged', merged_into = p_primary_id, deleted_at = now(), assigned_to = null
  where id = p_secondary_id;

  v_result := jsonb_build_object(
    'orders_moved', v_orders_moved,
    'phones_moved', v_phones_moved,
    'addresses_moved', v_addresses_moved,
    'notes_moved', v_notes_moved,
    'events_moved', v_events_moved,
    'follow_ups_moved', v_followups_moved,
    'tags_moved', v_tags_moved,
    'tags_soft_removed', v_tags_soft_removed,
    'external_ids_moved', v_external_ids_moved,
    'score_history_moved', v_score_history_moved
  );

  insert into public.customer_merges (primary_customer_id, merged_customer_id, merged_by, audit)
  values (p_primary_id, p_secondary_id, p_actor_id, v_result);

  insert into public.customer_events (customer_id, event_type, title, description, related_employee_id, metadata)
  values (
    p_primary_id,
    'customer.merged',
    'Customer merged',
    format('Merged duplicate customer (%s) into this record', p_secondary_id),
    p_actor_id,
    v_result
  );

  return v_result;
end;
$$;

-- security definer bypasses RLS by design (the merge touches rows across
-- many tables regardless of the caller's own row visibility) — so it must
-- NOT be directly callable by ordinary sessions. The app always calls this
-- through the service-role client from a server action that has already
-- checked the caller has duplicates.merge permission.
revoke execute on function public.merge_customers(uuid, uuid, uuid) from public, anon, authenticated;
