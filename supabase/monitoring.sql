-- طلبات في الـ24 ساعة الماضية
select status, channel, count(*) as count
from public.reminder_delivery_log
where created_at >= now() - interval '24 hours'
group by status, channel
order by status, channel;

-- الأخطاء في آخر 24 ساعة
select id, item_id, reminder_kind, channel, error, created_at
from public.reminder_delivery_log
where status = 'failed'
  and created_at >= now() - interval '24 hours'
order by created_at desc;

-- فحص آخر تشغيل فعلي للـ cron من جدول pg_cron
select jobid, jobname, last_run, last_success
from cron.job
where jobname = 'send-reminders-every-minute';
