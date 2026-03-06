-- Repair legacy remote projects where recordings schema/bucket differs from app expectations.
-- This migration is safe to run multiple times.

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'recordings'
  ) then
    return;
  end if;

  alter table public.recordings add column if not exists uploader_id uuid;
  alter table public.recordings add column if not exists description text;
  alter table public.recordings add column if not exists duration_seconds numeric;
  alter table public.recordings add column if not exists language_tag text default 'semai';
  alter table public.recordings add column if not exists dialect text;
  alter table public.recordings add column if not exists topic_tags text[];
  alter table public.recordings add column if not exists translation text;
  alter table public.recordings add column if not exists is_verified boolean default false;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recordings'
      and column_name = 'user_id'
  ) then
    execute '
      update public.recordings
      set uploader_id = coalesce(uploader_id, user_id)
      where uploader_id is null
    ';
    execute '
      update public.recordings
      set user_id = coalesce(user_id, uploader_id)
      where user_id is null
    ';
    execute 'alter table public.recordings alter column user_id drop not null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recordings'
      and column_name = 'elder_id'
  ) then
    execute '
      update public.recordings
      set uploader_id = coalesce(uploader_id, elder_id)
      where uploader_id is null
    ';
    execute '
      update public.recordings
      set elder_id = coalesce(elder_id, uploader_id)
      where elder_id is null
    ';
    execute 'alter table public.recordings alter column elder_id drop not null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'recordings'
      and column_name = 'duration'
  ) then
    execute '
      update public.recordings
      set duration_seconds = coalesce(duration_seconds, duration)
      where duration_seconds is null
    ';
    execute 'alter table public.recordings alter column duration drop not null';
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'recordings'
      and constraint_name = 'recordings_uploader_id_fkey'
      and constraint_type = 'FOREIGN KEY'
  ) then
    alter table public.recordings
      add constraint recordings_uploader_id_fkey
      foreign key (uploader_id) references public.profiles(id) on delete cascade;
  end if;

  update public.recordings
  set language_tag = 'semai'
  where language_tag is null or btrim(language_tag) = '';

  update public.recordings
  set is_verified = false
  where is_verified is null;

  alter table public.recordings alter column uploader_id set not null;
  alter table public.recordings enable row level security;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'recordings'
      and policyname = 'Studio uploaders can insert recordings'
  ) then
    execute '
      create policy "Studio uploaders can insert recordings"
      on public.recordings
      for insert
      with check (auth.uid() = uploader_id)
    ';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'recordings'
      and policyname = 'Studio uploaders can update recordings'
  ) then
    execute '
      create policy "Studio uploaders can update recordings"
      on public.recordings
      for update
      using (auth.uid() = uploader_id)
      with check (auth.uid() = uploader_id)
    ';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'recordings'
      and policyname = 'Studio uploaders can delete recordings'
  ) then
    execute '
      create policy "Studio uploaders can delete recordings"
      on public.recordings
      for delete
      using (auth.uid() = uploader_id)
    ';
  end if;
end
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recordings',
  'recordings',
  false,
  52428800,
  array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Recordings owners can upload'
  ) then
    execute '
      create policy "Recordings owners can upload"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = ''recordings''
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    ';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Recordings owners can read'
  ) then
    execute '
      create policy "Recordings owners can read"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = ''recordings''
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    ';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Recordings owners can delete'
  ) then
    execute '
      create policy "Recordings owners can delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = ''recordings''
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    ';
  end if;
end
$$;

do $$
begin
  -- Allow elders and admins to read any file in the recordings bucket so they
  -- can create signed URLs for recordings uploaded by other users during review.
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Elders and admins can read recordings'
  ) then
    execute '
      create policy "Elders and admins can read recordings"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = ''recordings''
        and exists (
          select 1
          from public.profiles
          where id = auth.uid() and role in (''elder'', ''admin'')
        )
      )
    ';
  end if;
end
$$;
