-- Ensure DELETE policies required by app features exist.
-- Idempotent: only creates each policy when missing.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'progress'
      and policyname = 'Users can delete own progress'
  ) then
    execute $policy$
      create policy "Users can delete own progress"
        on public.progress
        for delete
        using (auth.uid() = user_id)
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'streaks'
      and policyname = 'Users can delete own streak'
  ) then
    execute $policy$
      create policy "Users can delete own streak"
        on public.streaks
        for delete
        using (auth.uid() = user_id)
    $policy$;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated users can delete pronunciations'
  ) then
    execute $policy$
      create policy "Authenticated users can delete pronunciations"
        on storage.objects
        for delete
        to authenticated
        using (bucket_id = 'pronunciations')
    $policy$;
  end if;
end
$$;
