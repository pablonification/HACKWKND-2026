alter table public.profiles
  add column if not exists onboarding_completed boolean,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_responses jsonb;

update public.profiles
set onboarding_completed = true
where onboarding_completed is null;

alter table public.profiles
  alter column onboarding_completed set default false,
  alter column onboarding_completed set not null;
