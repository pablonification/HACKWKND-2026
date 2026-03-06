-- Add review pipeline fields for recordings and canonical semai_key for words.
-- Safe to run multiple times.

create or replace function public.normalize_semai_key(input text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    replace(
      replace(
        replace(
          lower(coalesce(input, '')),
          'ɔ',
          'o'
        ),
        'ə',
        'e'
      ),
      'ɨ',
      'i'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  )
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'recordings'
  ) then
    alter table public.recordings add column if not exists raw_transcription text;
    alter table public.recordings add column if not exists auto_transcription text;
    alter table public.recordings add column if not exists verified_transcription text;
    alter table public.recordings add column if not exists transcription_candidates jsonb;
    alter table public.recordings add column if not exists transcription_language text;
    alter table public.recordings add column if not exists auto_translation_ms text;
    alter table public.recordings add column if not exists verified_translation_ms text;
    alter table public.recordings add column if not exists verified_at timestamptz;
    alter table public.recordings add column if not exists verified_by uuid references public.profiles(id) on delete set null;

    update public.recordings
    set auto_transcription = coalesce(auto_transcription, transcription)
    where transcription is not null;

    update public.recordings
    set verified_transcription = coalesce(verified_transcription, transcription)
    where is_verified = true
      and transcription is not null;

    update public.recordings
    set auto_translation_ms = coalesce(auto_translation_ms, translation)
    where translation is not null;

    update public.recordings
    set verified_translation_ms = coalesce(verified_translation_ms, translation)
    where is_verified = true
      and translation is not null;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'words'
  ) then
    alter table public.words add column if not exists semai text;
    alter table public.words add column if not exists semai_key text;
    alter table public.words add column if not exists semai_word text;
    alter table public.words add column if not exists meaning_ms text;
    alter table public.words add column if not exists malay_translation text;
    alter table public.words add column if not exists meaning_en text;
    alter table public.words add column if not exists english_translation text;
    alter table public.words add column if not exists topic_tags text[];
    alter table public.words add column if not exists category text;
    alter table public.words add column if not exists elder_id uuid references public.profiles(id) on delete set null;
    alter table public.words add column if not exists created_by uuid references public.profiles(id) on delete set null;
    alter table public.words add column if not exists updated_at timestamptz default now();

    update public.words
    set
      semai = coalesce(nullif(btrim(semai), ''), nullif(btrim(semai_word), '')),
      semai_word = coalesce(nullif(btrim(semai_word), ''), nullif(btrim(semai), '')),
      meaning_ms = coalesce(nullif(btrim(meaning_ms), ''), nullif(btrim(malay_translation), '')),
      malay_translation = coalesce(nullif(btrim(malay_translation), ''), nullif(btrim(meaning_ms), '')),
      meaning_en = coalesce(nullif(btrim(meaning_en), ''), nullif(btrim(english_translation), '')),
      english_translation = coalesce(nullif(btrim(english_translation), ''), nullif(btrim(meaning_en), '')),
      category = coalesce(nullif(btrim(category), ''), (topic_tags)[1]),
      topic_tags = coalesce(topic_tags, case when nullif(btrim(category), '') is null then null else array[category] end),
      elder_id = coalesce(elder_id, created_by),
      created_by = coalesce(created_by, elder_id),
      updated_at = coalesce(updated_at, created_at, now()),
      semai_key = public.normalize_semai_key(coalesce(nullif(btrim(semai_word), ''), nullif(btrim(semai), '')))
    where
      semai_key is null
      or btrim(semai_key) = ''
      or semai is null
      or semai_word is null
      or meaning_ms is null
      or malay_translation is null
      or meaning_en is null
      or english_translation is null
      or category is null
      or topic_tags is null
      or elder_id is null
      or created_by is null
      or updated_at is null;

    alter table public.words alter column semai_key set not null;
  end if;
end
$$;

create unique index if not exists words_semai_key_unique_idx on public.words (semai_key);
