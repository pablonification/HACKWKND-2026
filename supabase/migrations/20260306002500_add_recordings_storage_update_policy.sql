-- Allow idempotent uploads with upsert=true for recordings bucket.
-- Without UPDATE policy, retries can fail with RLS 403.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Recordings owners can update'
  ) then
    execute '
      create policy "Recordings owners can update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = ''recordings''
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = ''recordings''
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    ';
  end if;
end
$$;
