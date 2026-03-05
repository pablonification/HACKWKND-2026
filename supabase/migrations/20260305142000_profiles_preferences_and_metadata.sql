-- Add profile metadata and preference columns required by the Profile module.
-- Safe to run in environments where columns may already exist.

alter table public.profiles
  add column if not exists village text,
  add column if not exists age integer,
  add column if not exists specialty text,
  add column if not exists app_language text,
  add column if not exists indigenous_language text,
  add column if not exists push_notifications_enabled boolean;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_age_range_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_age_range_check
      check (age is null or (age between 0 and 130));
  end if;
end
$$;
update public.profiles
set app_language = 'English'
where app_language is null;
update public.profiles
set indigenous_language = 'Semai'
where indigenous_language is null;
update public.profiles
set push_notifications_enabled = true
where push_notifications_enabled is null;
alter table public.profiles
  alter column app_language set default 'English',
  alter column indigenous_language set default 'Semai',
  alter column push_notifications_enabled set default true;
alter table public.profiles
  alter column app_language set not null,
  alter column indigenous_language set not null,
  alter column push_notifications_enabled set not null;
