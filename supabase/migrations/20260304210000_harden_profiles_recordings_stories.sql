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

  execute 'drop policy if exists "Elders and admins can verify recordings" on public.recordings';
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
    )
  ';
end
$$;
