-- Persistent Personal AI Buddy chat threads.

create table public.tavi_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New chat',
  session_phase text not null default 'idle',
  track text not null default 'vocabulary_first',
  last_message_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.tavi_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.tavi_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'tavi')),
  text text not null,
  package_eligible boolean not null default false,
  translation text,
  translation_label text,
  coach_note text,
  follow_up_prompt text,
  warning text,
  mode text,
  answer_language text,
  session_phase text,
  track text,
  created_at timestamptz not null default now()
);

create index tavi_threads_user_recent_idx
  on public.tavi_threads (user_id, deleted_at, last_message_at desc);

create index tavi_messages_thread_created_idx
  on public.tavi_messages (thread_id, created_at asc);

alter table public.tavi_threads enable row level security;
alter table public.tavi_messages enable row level security;

create policy "Users can read own Tavi threads"
  on public.tavi_threads for select using (auth.uid() = user_id);

create policy "Users can create own Tavi threads"
  on public.tavi_threads for insert with check (auth.uid() = user_id);

create policy "Users can update own Tavi threads"
  on public.tavi_threads for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own Tavi threads"
  on public.tavi_threads for delete using (auth.uid() = user_id);

create policy "Users can read own Tavi messages"
  on public.tavi_messages for select using (auth.uid() = user_id);

create policy "Users can create own Tavi messages"
  on public.tavi_messages for insert with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.tavi_threads
      where tavi_threads.id = tavi_messages.thread_id
        and tavi_threads.user_id = auth.uid()
        and tavi_threads.deleted_at is null
    )
  );

create policy "Users can update own Tavi messages"
  on public.tavi_messages for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own Tavi messages"
  on public.tavi_messages for delete using (auth.uid() = user_id);
