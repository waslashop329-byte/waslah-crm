create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_roles_updated_at before update on public.roles for each row execute function public.set_updated_at();
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger trg_customer_notes_updated_at before update on public.customer_notes for each row execute function public.set_updated_at();
create trigger trg_follow_ups_updated_at before update on public.follow_ups for each row execute function public.set_updated_at();
create trigger trg_scoring_rules_updated_at before update on public.scoring_rules for each row execute function public.set_updated_at();
create trigger trg_segments_updated_at before update on public.segments for each row execute function public.set_updated_at();
create trigger trg_integrations_updated_at before update on public.integrations for each row execute function public.set_updated_at();
create trigger trg_automation_rules_updated_at before update on public.automation_rules for each row execute function public.set_updated_at();
