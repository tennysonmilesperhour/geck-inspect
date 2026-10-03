-- Onboarding state lives on the profile, not per browser (audit step 32),
-- so a second phone does not ask the keeper-or-breeder question again.
-- Additive: older clients keep using localStorage and never touch these.
alter table public.profiles add column if not exists onboarding_role text;
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;
alter table public.profiles add column if not exists keeper_mode boolean;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_onboarding_role_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_onboarding_role_check check (onboarding_role is null or onboarding_role in ('keeper', 'breeder', 'everything')) not valid;
  end if;
end $$;
comment on column public.profiles.onboarding_role is 'Answer to the first-run question: keeper, breeder, or everything (closed without choosing).';
comment on column public.profiles.onboarding_completed_at is 'When the first-run question was answered or dismissed. Null means ask on the next sign-in.';
comment on column public.profiles.keeper_mode is 'Keeper mode (hide breeder-only pages). Null means not set; the browser setting is used.';
