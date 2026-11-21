alter table public.profiles
  add column if not exists push_enabled boolean not null default true,
  add column if not exists telegram_enabled boolean not null default true;

grant update (timezone, push_enabled, telegram_enabled) on table public.profiles to authenticated;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  constraint push_subscriptions_endpoint_unique unique (endpoint)
);

alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant all on table public.push_subscriptions to service_role;

drop policy if exists push_subscriptions_manage_own on public.push_subscriptions;
create policy push_subscriptions_manage_own
  on public.push_subscriptions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- السماح بالدالة بـ service role فقط، ولا يسمح للمستخدم بمعالجة اشتراكات الآخرين.
comment on table public.push_subscriptions is
  'اشتراكات Web Push؛ إدارة القراءة والكتابة للمستخدم مع إرسال السيرفر عبر service_role.';

comment on column public.profiles.push_enabled is 'تفعيل قناة Web Push للمستخدم.';
comment on column public.profiles.telegram_enabled is 'تفعيل قناة تيليجرام للمستخدم.';

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
    where item.status = 'scheduled'
      and item.reminder_missed_at is null
      and (
        (profile.telegram_enabled and profile.telegram_chat_id is not null)
        or (
          profile.push_enabled
          and exists (
            select 1
            from public.push_subscriptions as subscription
            where subscription.user_id = profile.id
          )
        )
      )
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

revoke all on function public.claim_due_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(integer) to service_role;
