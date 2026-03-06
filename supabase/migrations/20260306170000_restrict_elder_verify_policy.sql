-- Restrict the elder/admin verification UPDATE policy to add a row-level guard.
-- Elders may only update recordings they did not upload (prevents self-verification).
-- The is_verified = false guard is removed from USING so elders can save draft progress
-- on already-verified recordings without being blocked.
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
      and exists (
        select 1
        from public.profiles
        where id = auth.uid() and role in (''elder'', ''admin'')
      )
    )
    with check (
      uploader_id <> auth.uid()
      and exists (
        select 1
        from public.profiles
        where id = auth.uid() and role in (''elder'', ''admin'')
      )
    )
  ';
end
$$;
