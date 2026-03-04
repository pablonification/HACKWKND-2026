-- Initial schema for TUYANG: Semai language preservation platform
-- 8 tables: profiles, recordings, words, progress, streaks, stories, requests, follows

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  username    text unique,
  full_name   text,
  role        text check (role in ('learner', 'elder', 'admin')),
  avatar_url  text,
  bio         text,
  created_at  timestamptz default now(),
  updated_at  timestamptz
);

alter table public.profiles enable row level security;

create policy "Users can read any profile"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- ─────────────────────────────────────────────
-- recordings
-- ─────────────────────────────────────────────
create table public.recordings (
  id                uuid primary key default gen_random_uuid(),
  uploader_id       uuid not null references public.profiles(id) on delete cascade,
  title             text not null,
  description       text,
  audio_url         text not null,
  duration_seconds  numeric,
  language_tag      text default 'semai',
  dialect           text,
  topic_tags        text[],
  transcription     text,
  translation       text,
  is_verified       boolean default false,
  created_at        timestamptz default now(),
  updated_at        timestamptz
);

alter table public.recordings enable row level security;

create policy "Anyone can read recordings"
  on public.recordings for select using (true);

create policy "Authenticated users can insert recordings"
  on public.recordings for insert with check (auth.uid() = uploader_id);

create policy "Uploaders can update own recordings"
  on public.recordings for update using (auth.uid() = uploader_id);

create policy "Uploaders can delete own recordings"
  on public.recordings for delete using (auth.uid() = uploader_id);

-- ─────────────────────────────────────────────
-- words
-- ─────────────────────────────────────────────
create table public.words (
  id                   uuid primary key default gen_random_uuid(),
  semai_word           text not null,
  malay_translation    text,
  english_translation  text,
  pronunciation_url    text,
  example_sentence     text,
  topic_tags           text[],
  difficulty           text check (difficulty in ('beginner', 'intermediate', 'advanced')),
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz default now()
);

alter table public.words enable row level security;

create policy "Anyone can read words"
  on public.words for select using (true);

create policy "Authenticated users can insert words"
  on public.words for insert with check (auth.uid() = created_by);

create policy "Creators can update own words"
  on public.words for update using (auth.uid() = created_by);

-- ─────────────────────────────────────────────
-- progress
-- ─────────────────────────────────────────────
create table public.progress (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  word_id           uuid not null references public.words(id) on delete cascade,
  mastery_level     integer default 0 check (mastery_level between 0 and 5),
  next_review_at    timestamptz,
  last_reviewed_at  timestamptz,
  created_at        timestamptz default now(),
  unique (user_id, word_id)
);

alter table public.progress enable row level security;

create policy "Users can read own progress"
  on public.progress for select using (auth.uid() = user_id);

create policy "Users can upsert own progress"
  on public.progress for insert with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on public.progress for update using (auth.uid() = user_id);

create policy "Users can delete own progress"
  on public.progress for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- streaks
-- ─────────────────────────────────────────────
create table public.streaks (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references public.profiles(id) on delete cascade,
  current_streak       integer default 0,
  longest_streak       integer default 0,
  last_activity_date   date,
  updated_at           timestamptz
);

alter table public.streaks enable row level security;

create policy "Users can read own streak"
  on public.streaks for select using (auth.uid() = user_id);

create policy "Users can upsert own streak"
  on public.streaks for insert with check (auth.uid() = user_id);

create policy "Users can update own streak"
  on public.streaks for update using (auth.uid() = user_id);

create policy "Users can delete own streak"
  on public.streaks for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- stories
-- ─────────────────────────────────────────────
create table public.stories (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid references public.profiles(id) on delete set null,
  title         text not null,
  content       text not null,
  image_url     text,
  image_prompt  text,
  topic_tags    text[],
  is_published  boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz
);

alter table public.stories enable row level security;

create policy "Anyone can read published stories"
  on public.stories for select using (is_published = true);

create policy "Authors can read own stories"
  on public.stories for select using (auth.uid() = author_id);

create policy "Authenticated users can insert stories"
  on public.stories for insert with check (auth.uid() is not null);

create policy "Authors can update own stories"
  on public.stories for update using (auth.uid() = author_id);

-- ─────────────────────────────────────────────
-- requests
-- ─────────────────────────────────────────────
create table public.requests (
  id             uuid primary key default gen_random_uuid(),
  requester_id   uuid not null references public.profiles(id) on delete cascade,
  request_type   text check (request_type in ('word', 'phrase', 'topic', 'story')),
  content        text not null,
  status         text default 'pending' check (status in ('pending', 'in_progress', 'fulfilled', 'rejected')),
  fulfilled_by   uuid references public.profiles(id) on delete set null,
  created_at     timestamptz default now(),
  updated_at     timestamptz
);

alter table public.requests enable row level security;

create policy "Anyone can read requests"
  on public.requests for select using (true);

create policy "Users can create requests"
  on public.requests for insert with check (auth.uid() = requester_id);

create policy "Users can update own requests"
  on public.requests for update using (auth.uid() = requester_id);

-- ─────────────────────────────────────────────
-- follows
-- ─────────────────────────────────────────────
create table public.follows (
  id            uuid primary key default gen_random_uuid(),
  follower_id   uuid not null references public.profiles(id) on delete cascade,
  following_id  uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz default now(),
  unique (follower_id, following_id),
  check (follower_id != following_id)
);

alter table public.follows enable row level security;

create policy "Anyone can read follows"
  on public.follows for select using (true);

create policy "Users can follow others"
  on public.follows for insert with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on public.follows for delete using (auth.uid() = follower_id);
