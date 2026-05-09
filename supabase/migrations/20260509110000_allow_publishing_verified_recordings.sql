create or replace function public.guard_verified_recording_publish_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
    and auth.uid() = old.uploader_id
    and old.is_verified = true
    and (to_jsonb(new) - 'cover_url' - 'bg_url' - 'is_published')
      is distinct from (to_jsonb(old) - 'cover_url' - 'bg_url' - 'is_published')
  then
    raise exception 'Verified recording publishing can only update cover_url, bg_url, and is_published.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_verified_recording_publish_update on public.recordings;

create trigger guard_verified_recording_publish_update
before update on public.recordings
for each row
execute function public.guard_verified_recording_publish_update();

create policy "Uploaders can publish own verified recordings"
on public.recordings
for update
to authenticated
using (
  auth.uid() is not null
  and auth.uid() = uploader_id
  and is_verified = true
)
with check (
  auth.uid() is not null
  and auth.uid() = uploader_id
  and is_verified = true
);
