-- Some rules are threshold-based bonuses (e.g. "high total spend") rather
-- than per-unit multipliers — this column holds that threshold when a rule
-- needs one; unused rules leave it null.
alter table public.scoring_rules add column threshold numeric(14,2);

update public.scoring_rules set threshold = 10000 where key = 'high_total_value';
