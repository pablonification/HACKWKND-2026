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
      with check (
        exists (
          select 1 from public.profiles
          where id = auth.uid() and role in (''elder'', ''admin'')
        )
        and uploader_id is not distinct from (select r.uploader_id from public.recordings r where r.id = recordings.id)
        and title         is not distinct from (select r.title from public.recordings r where r.id = recordings.id)
        and audio_url     is not distinct from (select r.audio_url from public.recordings r where r.id = recordings.id)
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

-- 4. Profiles INSERT: prevent self-assignment of admin role.
-- Without this, a user could call supabase.from('profiles').insert({ id: uid, role: 'admin' }).
do $$
begin
  execute 'drop policy if exists "Users can insert own profile" on public.profiles';
  execute '
    create policy "Users can insert own profile"
    on public.profiles
    for insert
    with check (
      auth.uid() = id
      and (role is null or role in (''learner'', ''elder''))
    )
  ';
end
$$;

-- 5. Words UPDATE: pin created_by to current value so creators cannot
-- transfer ownership of a word entry to another user.
do $$
begin
  execute 'drop policy if exists "Creators can update own words" on public.words';
  execute '
    create policy "Creators can update own words"
    on public.words
    for update
    using (auth.uid() = created_by)
    with check (
      auth.uid() = created_by
      and created_by is not distinct from (
        select w.created_by from public.words w where w.id = words.id
      )
    )
  ';
end
$$;

-- 6. Progress UPDATE: pin user_id to current value so users cannot
-- reassign progress records to another user.
do $$
begin
  execute 'drop policy if exists "Users can update own progress" on public.progress';
  execute '
    create policy "Users can update own progress"
    on public.progress
    for update
    using (auth.uid() = user_id)
    with check (
      auth.uid() = user_id
      and user_id is not distinct from (
        select p.user_id from public.progress p where p.id = progress.id
      )
    )
  ';
end
$$;

-- 7. Streaks UPDATE: pin user_id to current value so users cannot
-- reassign streak records to another user.
do $$
begin
  execute 'drop policy if exists "Users can update own streak" on public.streaks';
  execute '
    create policy "Users can update own streak"
    on public.streaks
    for update
    using (auth.uid() = user_id)
    with check (
      auth.uid() = user_id
      and user_id is not distinct from (
        select s.user_id from public.streaks s where s.id = streaks.id
      )
    )
  ';
end
$$;

-- 8. Stories UPDATE: pin author_id to current value so authors cannot
-- transfer authorship of a story to another user.
do $$
begin
  execute 'drop policy if exists "Authors can update own stories" on public.stories';
  execute '
    create policy "Authors can update own stories"
    on public.stories
    for update
    using (auth.uid() = author_id)
    with check (
      auth.uid() = author_id
      and author_id is not distinct from (
        select st.author_id from public.stories st where st.id = stories.id
      )
    )
  ';
end
$$;

-- 9. Storage: restrict pronunciations DELETE to file owners only.
-- The original policy allowed any authenticated user to delete any pronunciation.
do $$
begin
  execute 'drop policy if exists "Authenticated users can delete pronunciations" on storage.objects';
  execute '
    create policy "Authenticated users can delete pronunciations"
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = ''pronunciations''
      and (storage.foldername(name))[1] = auth.uid()::text
    )
  ';
end
$$;

-- 10. Requests SELECT: restrict to authenticated users only.
-- The original policy used `using (true)` which exposed request content
-- (potentially personal) to unauthenticated / anonymous visitors.
do $$
begin
  execute 'drop policy if exists "Anyone can read requests" on public.requests';
  execute '
    create policy "Authenticated users can read requests"
    on public.requests
    for select
    using (auth.uid() is not null)
  ';
end
$$;
