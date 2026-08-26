-- Phase 10: cancellation reason capture (Part 12's "Voice of Customer").
-- Free-text `notes` already existed on order_call_attempts but doesn't
-- aggregate meaningfully — this adds a controlled category alongside it,
-- populated only when result = 'cancelled'.
alter table public.order_call_attempts add column reason_category text;
