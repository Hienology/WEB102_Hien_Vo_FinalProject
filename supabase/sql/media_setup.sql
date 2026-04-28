-- Media setup for post cover captions and comment media URLs.
-- Run this in the Supabase SQL editor after the base tables exist.

alter table public.posts
  add column if not exists image_caption text;

alter table public.comments
  add column if not exists media_url text,
  add column if not exists edited_at timestamptz,
  add column if not exists upvotes integer not null default 0;

update public.comments
set upvotes = 0
where upvotes is null;

create or replace function public.set_comment_edited_at()
returns trigger
language plpgsql
as $$
begin
  if new.content is distinct from old.content
     or new.media_url is distinct from old.media_url then
    new.edited_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_set_comment_edited_at on public.comments;

create trigger trigger_set_comment_edited_at
before update on public.comments
for each row
execute function public.set_comment_edited_at();

insert into storage.buckets (id, name, public)
values ('grand-slam-media', 'grand-slam-media', true)
on conflict (id) do update
set public = excluded.public;

do $$
begin
  create policy "Public read grand-slam-media"
    on storage.objects
    for select
    using (bucket_id = 'grand-slam-media');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Public upload grand-slam-media"
    on storage.objects
    for insert
    with check (bucket_id = 'grand-slam-media');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Public update grand-slam-media"
    on storage.objects
    for update
    using (bucket_id = 'grand-slam-media')
    with check (bucket_id = 'grand-slam-media');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Public delete grand-slam-media"
    on storage.objects
    for delete
    using (bucket_id = 'grand-slam-media');
exception
  when duplicate_object then null;
end $$;
