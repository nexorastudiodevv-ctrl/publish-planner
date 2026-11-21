-- عزل profiles وtelegram_link_codes وpush_subscriptions وcontent_items لمستخدمين.
begin;

do $$
declare
  user_a uuid;
  user_b uuid;
  marker text := 'rls-all-' || gen_random_uuid()::text;
begin
  select id into user_a from auth.users order by created_at, id limit 1;
  select id into user_b from auth.users where id <> user_a order by created_at, id limit 1;
  if user_a is null or user_b is null then raise exception 'يلزم مستخدمان اختباريان'; end if;
  perform set_config('publish_planner.user_a', user_a::text, true);
  perform set_config('publish_planner.user_b', user_b::text, true);
  perform set_config('publish_planner.marker', marker, true);

  insert into public.content_items (
    user_id, title, content_type, platform, scheduled_at
  ) values (user_a, marker, 'post', 'other', now());

  insert into public.telegram_link_codes (code, user_id)
  values ('A1' || substr(gen_random_uuid()::text, 1, 6), user_a);

  insert into public.push_subscriptions (
    user_id, endpoint, p256dh, auth
  ) values (
    user_a,
    'https://push.example.test/' || gen_random_uuid(),
    'p256dh-test',
    'auth-test'
  );
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('publish_planner.user_a'), 'role', 'authenticated')::text,
  true
);

do $$
begin
  if (select count(*) from public.content_items
      where title = current_setting('publish_planner.marker')) <> 1
  then raise exception 'فشل عزل content_items للمستخدم الأول'; end if;

  if (select count(*) from public.telegram_link_codes
      where user_id = current_setting('publish_planner.user_a')::uuid) < 1
  then raise exception 'فشل قراءة كود الربط للمستخدم الأول'; end if;

  if (select count(*) from public.push_subscriptions
      where user_id = current_setting('publish_planner.user_a')::uuid) < 1
  then raise exception 'فشل قراءة اشتراك Push للمستخدم الأول'; end if;

  if (select count(*) from public.profiles
      where id = current_setting('publish_planner.user_a')::uuid) <> 1
  then raise exception 'فشل قراءة profile للمستخدم الأول'; end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('publish_planner.user_b'), 'role', 'authenticated')::text,
  true
);

do $$
begin
  if exists (select 1 from public.content_items
             where title = current_setting('publish_planner.marker'))
  then raise exception 'المستخدم الثاني قرأ content_item لمستخدم آخر'; end if;
  if exists (select 1 from public.telegram_link_codes
             where user_id <> current_setting('publish_planner.user_b')::uuid)
  then raise exception 'المستخدم الثاني قرأ telegram_link_code لمستخدم آخر'; end if;
  if exists (select 1 from public.push_subscriptions
             where user_id <> current_setting('publish_planner.user_b')::uuid)
  then raise exception 'المستخدم الثاني قرأ push_subscription لمستخدم آخر'; end if;
  if exists (select 1 from public.profiles
             where id <> current_setting('publish_planner.user_b')::uuid)
  then raise exception 'المستخدم الثاني قرأ profile لمستخدم آخر'; end if;
end;
$$;

rollback;
