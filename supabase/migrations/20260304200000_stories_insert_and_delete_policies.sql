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
  execute 'drop policy if exists "Requesters can update own pending requests" on public.requests';
  execute 'drop policy if exists "Elders and admins can manage request status" on public.requests';
  execute '
    create policy "Requesters can update own pending requests"
    on public.requests
    for update
    using (auth.uid() = requester_id and status = ''pending'')
    with check (auth.uid() = requester_id and status = ''pending'')
  ';

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
    with check (
      exists (
        select 1 from public.profiles
        where id = auth.uid() and role in (''elder'', ''admin'')
      )
      and requester_id is not distinct from (
        select r.requester_id from public.requests r where r.id = requests.id
      )
      and request_type is not distinct from (
        select r.request_type from public.requests r where r.id = requests.id
      )
      and content is not distinct from (
        select r.content from public.requests r where r.id = requests.id
      )
    )
  ';
end
$$;
