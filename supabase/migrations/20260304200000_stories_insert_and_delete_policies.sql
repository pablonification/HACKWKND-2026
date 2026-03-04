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
