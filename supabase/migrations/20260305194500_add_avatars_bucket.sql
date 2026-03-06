-- Avatar uploads for profile editing
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  execute 'drop policy if exists "Anyone can read avatars" on storage.objects';
  execute 'drop policy if exists "Users can upload their own avatars" on storage.objects';
  execute 'drop policy if exists "Users can update their own avatars" on storage.objects';
  execute 'drop policy if exists "Users can delete their own avatars" on storage.objects';

  execute '
    create policy "Anyone can read avatars"
      on storage.objects for select
      to public
      using (bucket_id = ''avatars'')
  ';
  execute '
    create policy "Users can upload their own avatars"
      on storage.objects for insert
      to authenticated
      with check (
        bucket_id = ''avatars''
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  ';
  execute '
    create policy "Users can update their own avatars"
      on storage.objects for update
      to authenticated
      using (
        bucket_id = ''avatars''
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id = ''avatars''
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  ';
  execute '
    create policy "Users can delete their own avatars"
      on storage.objects for delete
      to authenticated
      using (
        bucket_id = ''avatars''
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  ';
end
$$;
