-- Fix stories INSERT policy: enforce author_id = auth.uid() to prevent misattribution.
-- Add missing DELETE policies for words, stories, requests, and profiles.
-- Idempotent so it can run safely in partially-provisioned environments.

-- 1. Harden stories INSERT policy (same pattern as the words fix)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stories'
      and column_name = 'author_id'
  ) then
    execute 'drop policy if exists "Authenticated users can insert stories" on public.stories';
    execute '
      create policy "Authenticated users can insert stories"
      on public.stories
      for insert
      with check (auth.uid() = author_id)
    ';
  end if;
end
$$;

-- 2. Add missing DELETE policies

-- words: creators can delete own words
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'words' and policyname = 'Creators can delete own words'
  ) then
    execute '
      create policy "Creators can delete own words"
      on public.words
      for delete
      using (auth.uid() = created_by)
    ';
  end if;
end
$$;

-- stories: authors can delete own stories
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'stories' and policyname = 'Authors can delete own stories'
  ) then
    execute '
      create policy "Authors can delete own stories"
      on public.stories
      for delete
      using (auth.uid() = author_id)
    ';
  end if;
end
$$;

-- requests: users can delete own requests
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'requests' and policyname = 'Users can delete own requests'
  ) then
    execute '
      create policy "Users can delete own requests"
      on public.requests
      for delete
      using (auth.uid() = requester_id)
    ';
  end if;
end
$$;

-- profiles: users can delete own profile
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'profiles' and policyname = 'Users can delete own profile'
  ) then
    execute '
      create policy "Users can delete own profile"
      on public.profiles
      for delete
      using (auth.uid() = id)
    ';
  end if;
end
$$;

-- 3. Restrict requests UPDATE policy
-- Requesters can only update content/type while the request is still pending.
-- Elders and admins can update status and fulfilled_by on any request.
do $$
begin
  execute 'drop policy if exists "Users can update own requests" on public.requests';
  execute '
    create policy "Requesters can update own pending requests"
    on public.requests
    for update
    using (auth.uid() = requester_id and status = ''pending'')
    with check (auth.uid() = requester_id and status = ''pending'')
  ';

  if not exists (
    select 1 from pg_policies
    where tablename = 'requests' and policyname = 'Elders and admins can manage request status'
  ) then
    execute '
      create policy "Elders and admins can manage request status"
      on public.requests
      for update
      using (
        exists (
          select 1 from public.profiles
          where id = auth.uid() and role in (''elder'', ''admin'')
        )
      )
    ';
  end if;
end
$$;

-- 4. Trigger to guard status/fulfilled_by on requests
-- All authenticated users share the same Postgres role in Supabase, so column-level
-- GRANT/REVOKE cannot distinguish requesters from elders. Instead, use a trigger to
-- reject status or fulfilled_by changes by non-elder/non-admin users.
create or replace function public.guard_request_status_update()
  returns trigger
  language plpgsql
  security definer
as $$
declare
  caller_role text;
begin
  -- Allow if neither status nor fulfilled_by changed
  if new.status is not distinct from old.status
     and new.fulfilled_by is not distinct from old.fulfilled_by then
    return new;
  end if;

  select role into caller_role
    from public.profiles
    where id = auth.uid();

  if caller_role not in ('elder', 'admin') then
    raise exception 'Only elders and admins can change request status or fulfilled_by';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_request_status on public.requests;
create trigger trg_guard_request_status
  before update on public.requests
  for each row
  execute function public.guard_request_status_update();
