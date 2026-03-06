-- Restrict the elder/admin verification UPDATE policy to add a row-level guard.
-- Elders may only verify recordings they did not upload (prevents self-verification)
-- and only while the recording is not yet verified (prevents overwriting an existing
-- verified record without also being the uploader).
-- Safe to run multiple times.

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

  -- Drop the unrestricted version added in a prior migration.
  execute 'drop policy if exists "Elders and admins can verify recordings" on public.recordings';

  -- Recreate with row-level guard: elder/admin can only UPDATE rows uploaded by
  -- a different user AND that have not yet been verified.
  execute '
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
        where id = auth.uid() and role in (''elder'', ''admin'')
      )
    )
    with check (
      exists (
        select 1
        from public.profiles
        where id = auth.uid() and role in (''elder'', ''admin'')
      )
    )
  ';
end
$$;
