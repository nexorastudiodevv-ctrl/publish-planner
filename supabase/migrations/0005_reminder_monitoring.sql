create table if not exists public.reminder_delivery_log (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.content_items (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  reminder_kind text not null check (reminder_kind in ('pre', 'final')),
  channel text not null check (channel in ('telegram', 'push', 'none')),
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists reminder_delivery_log_created_idx
  on public.reminder_delivery_log (created_at desc);
create index if not exists reminder_delivery_log_user_idx
  on public.reminder_delivery_log (user_id, created_at desc);

alter table public.reminder_delivery_log enable row level security;
revoke all on table public.reminder_delivery_log from public, anon, authenticated;
grant all on table public.reminder_delivery_log to service_role;

drop view if exists public.reminder_delivery_status;

create view public.reminder_delivery_status as
select
  item.id,
  item.user_id,
  item.title,
  item.status,
  item.scheduled_at,
  item.pre_reminder_sent_at,
  item.final_reminder_sent_at,
  item.reminder_missed_at,
  item.reminder_attempts,
  item.last_reminder_error,
  item.reminder_next_attempt_at
from public.content_items as item;

revoke all on table public.reminder_delivery_status from public, anon, authenticated;
grant select on table public.reminder_delivery_status to service_role;
