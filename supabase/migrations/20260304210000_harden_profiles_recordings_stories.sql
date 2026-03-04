-- Harden RLS policies: prevent role self-escalation on profiles,
-- restrict is_verified self-write on recordings,
-- add missing stories.author_id column default.
-- Idempotent so it can run safely in partially-provisioned environments.

-- 1. Profiles: prevent users from escalating their own role via UPDATE.
do $$
begin
  execute 'drop policy if exists "Users can update own profile" on public.profiles';
  execute '
    create policy "Users can update own profile"
    on public.profiles
    for update
    using (auth.uid() = id)
    with check (
      auth.uid() = id
      and role is not distinct from (
        select p.role from public.profiles p where p.id = id
      )
    )
  ';
end
$$;

-- 2. Recordings: prevent uploaders from flipping is_verified on their own recordings.
--    Add a separate policy so elders/admins can verify recordings.
do $$
begin
  execute 'drop policy if exists "Uploaders can update own recordings" on public.recordings';
  execute '
    create policy "Uploaders can update own recordings"
    on public.recordings
    for update
    using (auth.uid() = uploader_id)
    with check (
      auth.uid() = uploader_id
      and is_verified is not distinct from (
        select r.is_verified from public.recordings r where r.id = recordings.id
      )
    )
  ';

  if not exists (
    select 1 from pg_policies
    where tablename = 'recordings'
      and policyname = 'Elders and admins can verify recordings'
  ) then
    execute '
      create policy "Elders and admins can verify recordings"
      on public.recordings
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

-- 3. Stories: add column default so author_id is automatically set on insert,
--    matching the words.created_by fix from the previous migration.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stories'
      and column_name = 'author_id'
  ) then
    execute 'alter table public.stories alter column author_id set default auth.uid()';
  end if;
end
$$;
