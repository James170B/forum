alter table public.threads
  add column if not exists is_anonymous boolean not null default true;

alter table public.posts
  add column if not exists is_anonymous boolean not null default true;
