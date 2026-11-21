alter table public.content_items
  add column if not exists pre_reminder_sent_at timestamptz,
  add column if not exists final_reminder_sent_at timestamptz,
  add column if not exists reminder_attempts integer not null default 0,
  add column if not exists last_reminder_error text,
  add column if not exists reminder_missed_at timestamptz,
  add column if not exists reminder_claim_type text,
  add column if not exists reminder_claim_token uuid,
  add column if not exists reminder_claim_until timestamptz,
  add column if not exists reminder_claim_chat_id bigint,
  add column if not exists reminder_last_attempt_at timestamptz,
  add column if not exists reminder_next_attempt_at timestamptz;

create table if not exists public.reminder_send_rate_limit (
  singleton boolean primary key default true check (singleton),
  next_slot_at timestamptz not null default now()
);

insert into public.reminder_send_rate_limit (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.reminder_send_rate_limit enable row level security;
revoke all on table public.reminder_send_rate_limit from public, anon, authenticated;
grant all on table public.reminder_send_rate_limit to service_role;

alter table public.content_items
  drop constraint if exists content_items_reminder_attempts_check;
alter table public.content_items
  add constraint content_items_reminder_attempts_check
  check (reminder_attempts between 0 and 3);

alter table public.content_items
  drop constraint if exists content_items_reminder_claim_type_check;
alter table public.content_items
  add constraint content_items_reminder_claim_type_check
  check (reminder_claim_type is null or reminder_claim_type in ('pre', 'final'));

-- يُحفظ العمود القديم كتوافق مع الواجهة القديمة، ويُستخدم كوقت أول تذكير ناجح.
comment on column public.content_items.reminder_sent_at is
  'توافق خلفي: وقت أول تذكير ناجح؛ العمودان pre_reminder_sent_at وfinal_reminder_sent_at هما المصدر الدقيق لكل مرحلة.';
comment on column public.content_items.reminder_missed_at is
  'وقت إغلاق تذكير الموعد دون إرسال لأنه تجاوز حد التأخير.';

update public.content_items
set
  pre_reminder_sent_at = coalesce(pre_reminder_sent_at, reminder_sent_at),
  final_reminder_sent_at = coalesce(final_reminder_sent_at, reminder_sent_at)
where reminder_sent_at is not null;

drop index if exists public.content_items_pending_reminder_idx;
create index if not exists content_items_due_reminders_idx
  on public.content_items (scheduled_at)
  where status = 'scheduled'
    and reminder_missed_at is null
    and (pre_reminder_sent_at is null or final_reminder_sent_at is null);

create or replace function public.reset_reminder_sent_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.scheduled_at is distinct from old.scheduled_at
    or new.remind_before_minutes is distinct from old.remind_before_minutes then
    new.reminder_sent_at := null;
    new.pre_reminder_sent_at := null;
    new.final_reminder_sent_at := null;
    new.reminder_attempts := 0;
    new.last_reminder_error := null;
    new.reminder_missed_at := null;
    new.reminder_claim_type := null;
    new.reminder_claim_token := null;
    new.reminder_claim_until := null;
    new.reminder_claim_chat_id := null;
    new.reminder_last_attempt_at := null;
    new.reminder_next_attempt_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.mark_missed_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  missed_count integer;
begin
  update public.content_items
  set
    reminder_missed_at = now(),
    reminder_attempts = 3,
    last_reminder_error = 'missed:older_than_6_hours',
    reminder_claim_type = null,
    reminder_claim_token = null,
    reminder_claim_until = null,
    reminder_claim_chat_id = null
  where status = 'scheduled'
    and scheduled_at <= now() - interval '6 hours'
    and final_reminder_sent_at is null
    and reminder_missed_at is null;

  get diagnostics missed_count = row_count;
  return missed_count;
end;
$$;

create or replace function public.claim_due_reminders(batch_size integer)
returns table (
  id uuid,
  user_id uuid,
  title text,
  content_type public.content_type,
  platform public.platform,
  scheduled_at timestamptz,
  remind_before_minutes integer,
  note text,
  reminder_kind text,
  claim_token uuid,
  telegram_chat_id bigint,
  timezone text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.mark_missed_reminders();

  return query
  with due as (
    select
      item.id as item_id,
      case
        when item.scheduled_at <= now() then 'final'
        else 'pre'
      end as kind,
      case
        when item.scheduled_at <= now() then item.scheduled_at
        else item.scheduled_at - make_interval(mins => item.remind_before_minutes)
      end as due_at,
      profile.telegram_chat_id as chat_id
    from public.content_items as item
    join public.profiles as profile
      on profile.id = item.user_id
      and profile.telegram_chat_id is not null
    where item.status = 'scheduled'
      and item.reminder_missed_at is null
      and (
        (
          item.scheduled_at <= now()
          and item.scheduled_at > now() - interval '6 hours'
          and item.final_reminder_sent_at is null
        )
        or (
          item.remind_before_minutes > 0
          and item.scheduled_at > now()
          and item.scheduled_at - make_interval(mins => item.remind_before_minutes) <= now()
          and item.pre_reminder_sent_at is null
        )
      )
      and (
        item.reminder_claim_token is null
        or item.reminder_claim_until <= now()
      )
      and (
        item.reminder_claim_type is distinct from
          case when item.scheduled_at <= now() then 'final' else 'pre' end
        or (
          item.reminder_attempts < 3
          and (
            item.reminder_last_attempt_at is null
            or item.reminder_last_attempt_at <= now() - interval '1 minute'
          )
          and (
            item.reminder_next_attempt_at is null
            or item.reminder_next_attempt_at <= now()
          )
        )
      )
    order by due_at, item.id
    limit greatest(1, least(coalesce(batch_size, 100), 100))
    for update of item skip locked
  ),
  claimed as (
    update public.content_items as item
    set
      reminder_attempts = case
        when item.reminder_claim_type = due.kind then item.reminder_attempts + 1
        else 1
      end,
      reminder_claim_type = due.kind,
      reminder_claim_token = gen_random_uuid(),
      reminder_claim_until = now() + interval '5 minutes',
      reminder_claim_chat_id = due.chat_id,
      reminder_last_attempt_at = now(),
      reminder_next_attempt_at = null,
      last_reminder_error = case
        when item.reminder_claim_type is distinct from due.kind then null
        else item.last_reminder_error
      end
    from due
    where item.id = due.item_id
    returning
      item.id,
      item.user_id,
      item.title,
      item.content_type,
      item.platform,
      item.scheduled_at,
      item.remind_before_minutes,
      item.note,
      item.reminder_claim_type,
      item.reminder_claim_token,
      item.reminder_claim_chat_id
  )
  select
    claimed.id,
    claimed.user_id,
    claimed.title,
    claimed.content_type,
    claimed.platform,
    claimed.scheduled_at,
    claimed.remind_before_minutes,
    claimed.note,
    claimed.reminder_claim_type,
    claimed.reminder_claim_token,
    claimed.reminder_claim_chat_id,
    profile.timezone
  from claimed
  join public.profiles as profile on profile.id = claimed.user_id;
end;
$$;

create or replace function public.finish_reminder_attempt(
  p_item_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_error text default null,
  p_stop_retries boolean default false,
  p_retry_after_seconds integer default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim_kind text;
begin
  select reminder_claim_type
    into claim_kind
    from public.content_items
    where id = p_item_id
      and reminder_claim_token = p_claim_token
    for update;

  if not found then
    return false;
  end if;

  update public.content_items
  set
    pre_reminder_sent_at = case
      when p_success and claim_kind = 'pre' then now()
      else pre_reminder_sent_at
    end,
    final_reminder_sent_at = case
      when p_success and claim_kind = 'final' then now()
      else final_reminder_sent_at
    end,
    reminder_sent_at = case
      when p_success then coalesce(reminder_sent_at, now())
      else reminder_sent_at
    end,
    last_reminder_error = case
      when p_success then null
      else left(coalesce(p_error, 'telegram_send_failed'), 200)
    end,
    reminder_attempts = case
      when p_stop_retries then 3
      else reminder_attempts
    end,
    reminder_next_attempt_at = case
      when not p_success and p_retry_after_seconds is not null then
        now() + make_interval(secs => greatest(p_retry_after_seconds, 60))
      else null
    end,
    reminder_claim_token = null,
    reminder_claim_until = null,
    reminder_claim_chat_id = null
  where id = p_item_id
    and reminder_claim_token = p_claim_token;

  return found;
end;
$$;

create or replace function public.reserve_reminder_send_slot()
returns timestamptz
language sql
security definer
set search_path = ''
as $$
  update public.reminder_send_rate_limit
  set next_slot_at = greatest(next_slot_at, clock_timestamp()) + interval '50 milliseconds'
  where singleton = true
  returning next_slot_at;
$$;

create or replace function public.perform_telegram_item_action(
  p_item_id uuid,
  p_user_id uuid,
  p_action text
)
returns table (
  item_title text,
  scheduled_at timestamptz,
  action text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_action = 'done' then
    return query
      update public.content_items as item
      set status = 'published'
      where item.id = p_item_id
        and item.user_id = p_user_id
        and item.status = 'scheduled'
      returning item.title, item.scheduled_at, p_action;
  elsif p_action = 'snooze15' then
    return query
      update public.content_items as item
      set scheduled_at = item.scheduled_at + interval '15 minutes'
      where item.id = p_item_id
        and item.user_id = p_user_id
        and item.status = 'scheduled'
      returning item.title, item.scheduled_at, p_action;
  elsif p_action = 'cancel' then
    return query
      update public.content_items as item
      set status = 'cancelled'
      where item.id = p_item_id
        and item.user_id = p_user_id
        and item.status = 'scheduled'
      returning item.title, item.scheduled_at, p_action;
  else
    return;
  end if;
end;
$$;

revoke all on function public.mark_missed_reminders() from public, anon, authenticated;
revoke all on function public.claim_due_reminders(integer) from public, anon, authenticated;
revoke all on function public.finish_reminder_attempt(uuid, uuid, boolean, text, boolean, integer)
  from public, anon, authenticated;
revoke all on function public.reserve_reminder_send_slot()
  from public, anon, authenticated;
revoke all on function public.perform_telegram_item_action(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.mark_missed_reminders() to service_role;
grant execute on function public.claim_due_reminders(integer) to service_role;
grant execute on function public.finish_reminder_attempt(uuid, uuid, boolean, text, boolean, integer)
  to service_role;
grant execute on function public.reserve_reminder_send_slot() to service_role;
grant execute on function public.perform_telegram_item_action(uuid, uuid, text) to service_role;
