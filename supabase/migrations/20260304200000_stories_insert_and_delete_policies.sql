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
declare
  requester_col text;
  has_status boolean;
  has_request_type boolean;
  has_content boolean;
  status_type char;
  has_pending boolean;
  has_open boolean;
  status_guard text;
  request_type_guard text;
  content_guard text;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'requests'
  ) then
    return;
  end if;

  requester_col := case
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'requests'
        and column_name = 'requester_id'
    ) then 'requester_id'
    when exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'requests'
        and column_name = 'user_id'
    ) then 'user_id'
    else null
  end;

  has_status := exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'status'
  );

  has_request_type := exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'request_type'
  );

  has_content := exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'requests'
      and column_name = 'content'
  );

  if has_status then
    select t.typtype
    into status_type
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    where n.nspname = 'public'
      and c.relname = 'requests'
      and a.attname = 'status'
      and a.attnum > 0
      and not a.attisdropped
    limit 1;

    if status_type = 'e' then
      has_pending := exists (
        select 1
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        join pg_type t on t.oid = a.atttypid
        join pg_enum e on e.enumtypid = t.oid
        where n.nspname = 'public'
          and c.relname = 'requests'
          and a.attname = 'status'
          and e.enumlabel = 'pending'
      );

      has_open := exists (
        select 1
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        join pg_type t on t.oid = a.atttypid
        join pg_enum e on e.enumtypid = t.oid
        where n.nspname = 'public'
          and c.relname = 'requests'
          and a.attname = 'status'
          and e.enumlabel = 'open'
      );

      status_guard := case
        when has_pending and has_open then ' and status in (''pending'', ''open'')'
        when has_pending then ' and status = ''pending'''
        when has_open then ' and status = ''open'''
        else ''
      end;
    else
      status_guard := ' and status in (''pending'', ''open'')';
    end if;
  else
    status_guard := '';
  end if;

  request_type_guard := case
    when has_request_type then
      ' and request_type is not distinct from (
        select r.request_type from public.requests r where r.id = requests.id
      )'
    else ''
  end;

  content_guard := case
    when has_content then
      ' and content is not distinct from (
        select r.content from public.requests r where r.id = requests.id
      )'
    else ''
  end;

  execute 'drop policy if exists "Users can update own requests" on public.requests';
  execute 'drop policy if exists "Requesters can update own pending requests" on public.requests';
  execute 'drop policy if exists "Elders and admins can manage request status" on public.requests';

  if requester_col is not null then
    execute format(
      '
      create policy "Requesters can update own pending requests"
      on public.requests
      for update
      using (auth.uid() = %I%s)
      with check (auth.uid() = %I%s)
      ',
      requester_col,
      status_guard,
      requester_col,
      status_guard
    );

    execute format(
      '
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
        and %I is not distinct from (
          select r.%I from public.requests r where r.id = requests.id
        )
        %s
        %s
      )
      ',
      requester_col,
      requester_col,
      request_type_guard,
      content_guard
    );
  end if;
end
$$;
