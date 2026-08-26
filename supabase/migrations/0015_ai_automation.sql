create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- churn_pattern | cancellation_pattern | repeat_opportunity | high_value_opportunity | dashboard_summary
  title text not null,
  description text not null,
  data jsonb not null default '{}'::jsonb,
  related_customer_id uuid references public.customers(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_ai_insights_customer_id on public.ai_insights(related_customer_id);
create index idx_ai_insights_type on public.ai_insights(type);

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_event text not null,             -- e.g. 'order.delivered', 'customer.inactive_90d'
  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb, -- e.g. [{"type":"add_tag","tag":"Inactive"}]
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  automation_rule_id uuid not null references public.automation_rules(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete cascade,
  status text not null default 'success', -- success | failed
  result jsonb,
  executed_at timestamptz not null default now()
);

create index idx_automation_executions_rule_id on public.automation_executions(automation_rule_id);
