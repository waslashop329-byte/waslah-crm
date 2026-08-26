-- Part 2: score history must be explainable (previous score, diff, what triggered it).
alter table public.score_history
  add column previous_score integer,
  add column score_diff integer,
  add column trigger_event text;

-- Part 1: category thresholds (80/60/40 in the spec) must be configurable,
-- not hardcoded. One row per category.
create table public.score_category_thresholds (
  id uuid primary key default gen_random_uuid(),
  category text not null unique, -- excellent | trusted | medium_risk | high_risk
  min_score integer not null,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_score_category_thresholds_updated_at before update on public.score_category_thresholds for each row execute function public.set_updated_at();

alter table public.score_category_thresholds enable row level security;
create policy "score_category_thresholds_select" on public.score_category_thresholds for select to authenticated using (true);
create policy "score_category_thresholds_write" on public.score_category_thresholds for all to authenticated using (public.is_full_access()) with check (public.is_full_access());

insert into public.score_category_thresholds (category, min_score, label) values
  ('excellent', 80, 'Excellent'),
  ('trusted', 60, 'Trusted'),
  ('medium_risk', 40, 'Medium Risk'),
  ('high_risk', 0, 'High Risk');
