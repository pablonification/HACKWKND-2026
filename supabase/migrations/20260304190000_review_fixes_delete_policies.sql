-- Harden words ownership attribution for inserts.
-- Idempotent so it can run safely in partially-provisioned environments.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'words'
      and column_name = 'created_by'
  ) then
    execute 'alter table public.words alter column created_by set default auth.uid()';
    execute 'drop policy if exists "Authenticated users can insert words" on public.words';
    execute '
      create policy "Authenticated users can insert words"
      on public.words
      for insert
      with check (auth.uid() = created_by)
    ';
  end if;
end
$$;
