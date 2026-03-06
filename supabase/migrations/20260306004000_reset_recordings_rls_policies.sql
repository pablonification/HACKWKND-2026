-- Reset recordings RLS to a known baseline.
-- Some remote projects may contain legacy policies (for example role-gated inserts)
-- that conflict with the current Elder Studio flow.

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
    execute 'alter table public.recordings alter column elder_id drop not null';
  end if;
end
$$;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'recordings'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
  loop
    execute format('drop policy if exists %I on public.recordings', policy_row.policyname);
  end loop;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'recordings'
      and policyname = 'Anyone can read recordings'
      and cmd = 'SELECT'
  ) then
    execute '
      create policy "Anyone can read recordings"
      on public.recordings
      for select
      using (true)
    ';
  end if;
end
$$;

create policy "Authenticated users can insert recordings"
on public.recordings
for insert
to authenticated
with check (
  auth.uid() is not null
  and auth.uid() = uploader_id
);

create policy "Uploaders can update own recordings"
on public.recordings
for update
to authenticated
using (
  auth.uid() is not null
  and auth.uid() = uploader_id
)
with check (
  auth.uid() is not null
  and auth.uid() = uploader_id
);

create policy "Uploaders can delete own recordings"
on public.recordings
for delete
to authenticated
using (
  auth.uid() is not null
  and auth.uid() = uploader_id
);

create policy "Elders and admins can verify recordings"
on public.recordings
for update
to authenticated
using (
  uploader_id <> auth.uid()
  and (is_verified = false or is_verified is null)
  and exists (
    select 1
    from public.profiles
    where id = auth.uid() and role in ('elder', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid() and role in ('elder', 'admin')
  )
);
