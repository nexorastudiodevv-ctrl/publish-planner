create table if not exists public.telegram_link_attempts (
  chat_id bigint primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 1 check (attempts between 1 and 6)
);

alter table public.telegram_link_attempts enable row level security;

revoke all on table public.telegram_link_attempts from public, anon, authenticated;
grant all on table public.telegram_link_attempts to service_role;

create or replace function public.consume_telegram_link_attempt(p_chat_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempts integer;
begin
  insert into public.telegram_link_attempts as attempt_state (
    chat_id,
    window_started_at,
    attempts
  )
  values (p_chat_id, now(), 1)
  on conflict (chat_id) do update
  set
    window_started_at = case
      when attempt_state.window_started_at <= now() - interval '1 minute' then now()
      else attempt_state.window_started_at
    end,
    attempts = case
      when attempt_state.window_started_at <= now() - interval '1 minute' then 1
      else least(attempt_state.attempts + 1, 6)
    end
  returning attempts into current_attempts;

  return current_attempts <= 5;
end;
$$;

create or replace function public.link_telegram_code(p_code text, p_chat_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code_user_id uuid;
  code_expires_at timestamptz;
  code_used_at timestamptz;
  existing_user_id uuid;
begin
  select user_id, expires_at, used_at
    into code_user_id, code_expires_at, code_used_at
    from public.telegram_link_codes
    where code = p_code
    for update;

  if not found then
    return 'invalid';
  end if;

  if code_used_at is not null then
    return 'used';
  end if;

  if code_expires_at <= now() then
    return 'expired';
  end if;

  select id
    into existing_user_id
    from public.profiles
    where telegram_chat_id = p_chat_id;

  if found then
    return 'chat_already_linked';
  end if;

  update public.profiles
    set telegram_chat_id = p_chat_id
    where id = code_user_id
      and telegram_chat_id is null;

  if not found then
    return 'profile_unavailable';
  end if;

  update public.telegram_link_codes
    set used_at = now()
    where code = p_code;

  return 'linked';
exception
  when unique_violation then
    return 'chat_already_linked';
end;
$$;

revoke all on function public.consume_telegram_link_attempt(bigint)
  from public, anon, authenticated;
revoke all on function public.link_telegram_code(text, bigint)
  from public, anon, authenticated;
grant execute on function public.consume_telegram_link_attempt(bigint) to service_role;
grant execute on function public.link_telegram_code(text, bigint) to service_role;
