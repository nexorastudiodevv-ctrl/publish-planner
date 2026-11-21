-- استبدل القيمة النائبة بمعرّف مستخدم UUID موجود في auth.users قبل التشغيل.
insert into public.content_items (
  id,
  user_id,
  title,
  content_type,
  platform,
  scheduled_at,
  remind_before_minutes,
  note
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'REPLACE_WITH_AUTH_USER_UUID'::uuid,
    'فيديو تعريفي',
    'video',
    'youtube',
    now() + interval '1 day',
    30,
    'مثال تجريبي'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'REPLACE_WITH_AUTH_USER_UUID'::uuid,
    'ريلز جديد',
    'reel',
    'instagram',
    now() + interval '2 days',
    15,
    null
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'REPLACE_WITH_AUTH_USER_UUID'::uuid,
    'منشور أسبوعي',
    'post',
    'facebook',
    now() + interval '3 days',
    0,
    null
  )
on conflict (id) do nothing;
