alter table public.recordings
  add column if not exists transcription_match jsonb;

alter table public.recordings
  add column if not exists transcription_word_replacements jsonb;
