alter table public.recordings
  add column if not exists cover_url text,
  add column if not exists bg_url text,
  add column if not exists is_published boolean not null default false;
