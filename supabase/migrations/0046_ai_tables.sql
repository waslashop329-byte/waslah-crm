-- Phase 5: AI Intelligence Layer. Every table here stores AI *output* plus
-- enough metadata to judge trust in it (snapshot hash, provider, model,
-- usage) — the AI never becomes a second source of truth, it's a cache of
-- something explainable and regenerable from real CRM data.

-- One row per customer (upsert), not a history table — Part 4 only asks for
-- "the current summary + is it stale", not a summary timeline.
create table public.ai_customer_summaries (
  customer_id uuid primary key references public.customers(id) on delete cascade,
  summary text not null,
  key_points jsonb not null default '[]'::jsonb,
  concerns jsonb not null default '[]'::jsonb,
  recommended_action text,
  data_snapshot_hash text not null,
  is_stale boolean not null default false,
  provider text not null,
  model text not null,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_ai_customer_summaries_updated_at before update on public.ai_customer_summaries for each row execute function public.set_updated_at();

alter table public.ai_customer_summaries enable row level security;
create policy "ai_customer_summaries_select" on public.ai_customer_summaries for select to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));
create policy "ai_customer_summaries_write" on public.ai_customer_summaries for all to authenticated
  using (exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));

-- Unified approval-workflow table (Part 13): Next Best Action, tag
-- suggestions, and duplicate-merge recommendations are all "the AI proposes
-- an action, a human approves it, an existing CRM service executes it" — one
-- shape, one workflow, rather than three near-identical tables.
create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- next_best_action | tag_suggestion | duplicate_merge | new_tag_request
  customer_id uuid references public.customers(id) on delete cascade,
  duplicate_candidate_id uuid references public.duplicate_candidates(id) on delete cascade,
  proposed_action jsonb not null, -- same shape as an automation_rules action, when applicable
  reason text not null,
  priority text, -- low | medium | high
  confidence numeric(4,3), -- 0.000 - 1.000
  suggested_timing text,
  status text not null default 'pending', -- pending | approved | rejected | expired | applied | failed
  applied_result jsonb,
  error text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_ai_suggestions_customer on public.ai_suggestions(customer_id, status);
create index idx_ai_suggestions_status on public.ai_suggestions(status);

alter table public.ai_suggestions enable row level security;
create policy "ai_suggestions_select" on public.ai_suggestions for select to authenticated
  using (customer_id is null or exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));
create policy "ai_suggestions_write" on public.ai_suggestions for all to authenticated
  using (customer_id is null or exists (select 1 from public.customers c where c.id = customer_id and (public.is_full_access() or c.assigned_to = auth.uid())));

-- ai_insights already exists (migration 0015) as a Phase 1 placeholder —
-- "type/data" generic shape, unused by any code so far. Extend it in place
-- to the richer Phase 5 shape instead of creating a colliding second table.
alter table public.ai_insights rename column type to category;
alter table public.ai_insights rename column data to supporting_metrics;
alter table public.ai_insights rename column created_at to generated_at;
alter table public.ai_insights
  add column fact_summary text,
  add column inference text,
  add column recommended_action text,
  add column priority text not null default 'medium',
  add column confidence numeric(4,3),
  add column provider text,
  add column model text,
  add column data_snapshot_hash text;

update public.ai_insights set fact_summary = description where fact_summary is null;
alter table public.ai_insights alter column fact_summary set not null;

-- idx_ai_insights_type (0015) already indexes this column post-rename; just rename it to match.
alter index idx_ai_insights_type rename to idx_ai_insights_category;
create index idx_ai_insights_generated_at on public.ai_insights(generated_at desc);

create table public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id),
  feature text not null, -- customer_summary | next_best_action | tag_suggestion | risk_explanation | duplicate_analysis | business_insight | assistant
  entity_type text,
  entity_id text,
  provider text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric(10,6),
  cost_is_estimated boolean not null default true,
  duration_ms integer,
  status text not null default 'success', -- success | failed
  error text,
  created_at timestamptz not null default now()
);

create index idx_ai_usage_logs_created_at on public.ai_usage_logs(created_at desc);
create index idx_ai_usage_logs_feature on public.ai_usage_logs(feature, created_at desc);
create index idx_ai_usage_logs_user on public.ai_usage_logs(user_id, created_at desc);

alter table public.ai_usage_logs enable row level security;
create policy "ai_usage_logs_select" on public.ai_usage_logs for select to authenticated using (public.is_full_access() or user_id = auth.uid());
create policy "ai_usage_logs_write" on public.ai_usage_logs for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

-- Traces each suggestion back to the exact AI call that produced it.
alter table public.ai_suggestions add column usage_log_id uuid references public.ai_usage_logs(id);

-- Configurable pricing (Part 16: "do not permanently hardcode model pricing").
create table public.ai_model_pricing (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  input_price_per_1k numeric(10,6) not null,
  output_price_per_1k numeric(10,6) not null,
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index idx_ai_model_pricing_provider_model on public.ai_model_pricing(provider, model, effective_from);

alter table public.ai_model_pricing enable row level security;
create policy "ai_model_pricing_select" on public.ai_model_pricing for select to authenticated using (true);
create policy "ai_model_pricing_write" on public.ai_model_pricing for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

create table public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  output_type text not null, -- customer_summary | next_best_action | tag_suggestion | insight | assistant_message
  output_id text not null,
  rating text not null, -- helpful | not_helpful
  feedback_text text,
  created_at timestamptz not null default now()
);

create index idx_ai_feedback_output on public.ai_feedback(output_type, output_id);

alter table public.ai_feedback enable row level security;
create policy "ai_feedback_select" on public.ai_feedback for select to authenticated using (public.is_full_access() or user_id = auth.uid());
create policy "ai_feedback_insert" on public.ai_feedback for insert to authenticated with check (user_id = auth.uid());

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_ai_conversations_updated_at before update on public.ai_conversations for each row execute function public.set_updated_at();

alter table public.ai_conversations enable row level security;
create policy "ai_conversations_all" on public.ai_conversations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null, -- user | assistant | tool
  content text not null,
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

create index idx_ai_messages_conversation on public.ai_messages(conversation_id, created_at);

alter table public.ai_messages enable row level security;
create policy "ai_messages_all" on public.ai_messages for all to authenticated
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));
