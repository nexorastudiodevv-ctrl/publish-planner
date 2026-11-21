do $$
begin
  create type public.content_type as enum ('video', 'reel', 'post', 'story');
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.platform as enum (
    'youtube',
    'tiktok',
    'instagram',
    'facebook',
    'x',
    'linkedin',
    'snapchat',
    'telegram',
    'other'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.content_status as enum ('scheduled', 'published', 'cancelled');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  telegram_chat_id bigint unique,
  timezone text not null default 'Africa/Cairo',
  created_at timestamptz not null default now()
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  content_type public.content_type not null,
  platform public.platform not null,
  scheduled_at timestamptz not null,
  remind_before_minutes integer not null default 0
    check (remind_before_minutes between 0 and 1440),
  note text,
  status public.content_status not null default 'scheduled',
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telegram_link_codes (
  code text primary key default lower(
    substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)
  ),
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz
);

create index if not exists content_items_pending_reminder_idx
  on public.content_items (scheduled_at)
  where status = 'scheduled' and reminder_sent_at is null;

create index if not exists content_items_user_scheduled_idx
  on public.content_items (user_id, scheduled_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.reset_reminder_sent_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.scheduled_at is distinct from old.scheduled_at
    or new.remind_before_minutes is distinct from old.remind_before_minutes then
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists content_items_set_updated_at on public.content_items;
create trigger content_items_set_updated_at
  before update on public.content_items
  for each row execute function public.set_updated_at();

drop trigger if exists content_items_reset_reminder on public.content_items;
create trigger content_items_reset_reminder
  before update on public.content_items
  for each row execute function public.reset_reminder_sent_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.content_items enable row level security;
alter table public.telegram_link_codes enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.content_items from public, anon, authenticated;
revoke all on table public.telegram_link_codes from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (timezone) on table public.profiles to authenticated;
grant select, insert, update, delete on table public.content_items to authenticated;
grant select on table public.telegram_link_codes to authenticated;
grant insert (user_id) on table public.telegram_link_codes to authenticated;
grant all on table public.profiles to service_role;
grant all on table public.content_items to service_role;
grant all on table public.telegram_link_codes to service_role;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists content_items_manage_own on public.content_items;
create policy content_items_manage_own
  on public.content_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists telegram_link_codes_select_own on public.telegram_link_codes;
create policy telegram_link_codes_select_own
  on public.telegram_link_codes for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists telegram_link_codes_insert_own on public.telegram_link_codes;
create policy telegram_link_codes_insert_own
  on public.telegram_link_codes for insert to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.reset_reminder_sent_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
