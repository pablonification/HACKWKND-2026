do $$
begin
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
      and uploader_id is not distinct from (select r.uploader_id from public.recordings r where r.id = recordings.id)
      and title is not distinct from (select r.title from public.recordings r where r.id = recordings.id)
      and description is not distinct from (select r.description from public.recordings r where r.id = recordings.id)
      and audio_url is not distinct from (select r.audio_url from public.recordings r where r.id = recordings.id)
      and duration_seconds is not distinct from (select r.duration_seconds from public.recordings r where r.id = recordings.id)
      and language_tag is not distinct from (select r.language_tag from public.recordings r where r.id = recordings.id)
      and dialect is not distinct from (select r.dialect from public.recordings r where r.id = recordings.id)
      and topic_tags is not distinct from (select r.topic_tags from public.recordings r where r.id = recordings.id)
      and transcription is not distinct from (select r.transcription from public.recordings r where r.id = recordings.id)
      and translation is not distinct from (select r.translation from public.recordings r where r.id = recordings.id)
    )
  ';
end
$$;
