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
