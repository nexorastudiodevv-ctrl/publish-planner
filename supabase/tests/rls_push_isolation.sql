-- شغّل كمدير SQL بعد إنشاء مستخدمين اثنين؛ يتحقق من عزل الاشتراكات وقناة الإشعارات.
begin;

do $$
declare
  user_a uuid;
  user_b uuid;
begin
  select id into user_a from auth.users order by created_at, id limit 1;
  select id into user_b from auth.users where id <> user_a order by created_at, id limit 1;
  if user_a is null or user_b is null then raise exception 'يلزم مستخدمان اختباريان'; end if;
  perform set_config('publish_planner.user_a', user_a::text, true);
  perform set_config('publish_planner.user_b', user_b::text, true);
  insert into public.push_subscriptions (
    user_id, endpoint, p256dh, auth, user_agent
  ) values (
    user_a,
    'https://push.example.test/' || gen_random_uuid(),
    'test-p256dh',
    'test-auth',
    'rls-test'
  );
  perform set_config(
    'publish_planner.endpoint',
    (select endpoint from public.push_subscriptions where user_id = user_a order by created_at desc limit 1),
    true
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
  if (select count(*) from public.push_subscriptions
      where endpoint = current_setting('publish_planner.endpoint')) <> 1
  then raise exception 'المستخدم الأول لا يرى اشتراكه'; end;
  if (select count(*) from public.profiles
      where id <> (current_setting('publish_planner.user_a')::uuid)) <> 0
  then raise exception 'تمكن المستخدم الأول من رؤية ملف مستخدم آخر'; end;
end;
$$;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('publish_planner.user_b'), 'role', 'authenticated')::text,
  true
);

do $$
begin
  if (select count(*) from public.push_subscriptions
      where endpoint = current_setting('publish_planner.endpoint')) <> 0
  then raise exception 'المستخدم الثاني يرى اشتراك المستخدم الأول'; end;
end;
$$;

rollback;
