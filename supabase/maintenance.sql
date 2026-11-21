-- اجمع المهمة الأسبوعية مع تعطيلها عند الحاجة بحذفها من cron.job.
select cron.unschedule(jobid)
from cron.job
where jobname = 'publish-planner-weekly-cleanup';

select cron.schedule(
  'publish-planner-weekly-cleanup',
  '15 3 * * 0',
  $job$
    delete from public.telegram_link_codes
    where used_at is not null
       or expires_at <= now();

    delete from public.push_subscriptions
    where failure_count >= 5;

    delete from public.content_items
    where status in ('published', 'cancelled')
      and scheduled_at < now() - interval '90 days';
  $job$
);
