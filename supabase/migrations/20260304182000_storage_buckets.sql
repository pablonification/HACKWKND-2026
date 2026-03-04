-- Storage buckets for TUYANG app
-- recordings: audio files uploaded by elders
-- stories: illustrated story images (Nano Banana generated + manual uploads)
-- pronunciations: TTS-generated audio for Language Garden

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'recordings',
    'recordings',
    false,
    52428800, -- 50 MB per file
    array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/aac']
  ),
  (
    'stories',
    'stories',
    true,
    10485760, -- 10 MB per file
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'pronunciations',
    'pronunciations',
    true,
    5242880, -- 5 MB per file
    array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg']
  );

-- RLS policies: recordings (private — owner only + admin)
create policy "Users can upload their own recordings"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Authenticated users can read recordings"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'recordings');

create policy "Users can delete their own recordings"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS policies: stories (public read, authenticated write)
create policy "Anyone can read stories"
  on storage.objects for select
  to public
  using (bucket_id = 'stories');

create policy "Authenticated users can upload stories"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'stories');

create policy "Authenticated users can delete their own stories"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'stories'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS policies: pronunciations (public read, authenticated write)
create policy "Anyone can read pronunciations"
  on storage.objects for select
  to public
  using (bucket_id = 'pronunciations');

create policy "Authenticated users can upload pronunciations"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'pronunciations');

create policy "Authenticated users can delete pronunciations"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'pronunciations');
