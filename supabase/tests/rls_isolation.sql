-- شغّل هذا الاختبار كمدير قاعدة البيانات بعد إنشاء مستخدمين على الأقل.
begin;

do $$
declare
  test_user_a uuid;
  test_user_b uuid;
  test_marker text := 'RLS isolation test ' || gen_random_uuid()::text;
begin
  select id
    into test_user_a
    from auth.users
    order by created_at, id
    limit 1;

  select id
    into test_user_b
    from auth.users
    where id <> test_user_a
    order by created_at, id
    limit 1;

  if test_user_a is null or test_user_b is null then
    raise exception 'يلزم وجود مستخدمين اثنين على الأقل في auth.users';
  end if;

  insert into public.content_items (
    user_id,
    title,
    content_type,
    platform,
    scheduled_at
  )
  values (test_user_a, test_marker, 'post', 'other', now());

  perform set_config('publish_planner.test_user_a', test_user_a::text, true);
  perform set_config('publish_planner.test_user_b', test_user_b::text, true);
  perform set_config('publish_planner.test_marker', test_marker, true);
end;
$$;

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  current_setting('publish_planner.test_user_a'),
  true
);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('publish_planner.test_user_a'),
    'role', 'authenticated'
  )::text,
  true
);

do $$
begin
  if (
    select count(*)
    from public.content_items
    where title = current_setting('publish_planner.test_marker')
  ) <> 1 then
    raise exception 'المستخدم الأول لم يتمكن من قراءة صفه';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  current_setting('publish_planner.test_user_b'),
  true
);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('publish_planner.test_user_b'),
    'role', 'authenticated'
  )::text,
  true
);

do $$
begin
  if (
    select count(*)
    from public.content_items
    where title = current_setting('publish_planner.test_marker')
  ) <> 0 then
    raise exception 'تمكن المستخدم الثاني من قراءة صف المستخدم الأول';
  end if;
end;
$$;

rollback;
