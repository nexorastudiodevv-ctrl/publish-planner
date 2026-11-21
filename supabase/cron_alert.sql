-- تنبيه Telegram للمشرف؛ خزّن bot_token وadmin_chat_id في Vault ولا تضعهما في الكود.
select cron.unschedule(jobid)
from cron.job
where jobname = 'publish-planner-cron-health-alert';

select cron.schedule(
  'publish-planner-cron-health-alert',
  '* * * * *',
  $job$
    do $alert$
    declare
      failed_count integer;
      job_stale boolean;
      bot_token text;
      admin_chat_id text;
    begin
      select count(*)
        into failed_count
      from public.reminder_delivery_log
      where status = 'failed'
        and created_at >= now() - interval '24 hours';
      select coalesce(
        (
          select max(details.start_time) <= now() - interval '5 minutes'
          from cron.job_run_details as details
          join cron.job as job on job.jobid = details.jobid
          where job.jobname = 'send-reminders-every-minute'
        ),
        true
      ) into job_stale;

      if failed_count >= 20 or job_stale then
        select decrypted_secret into bot_token
        from vault.decrypted_secrets
        where name = 'telegram_bot_token';
        select decrypted_secret into admin_chat_id
        from vault.decrypted_secrets
        where name = 'admin_telegram_chat_id';

        if bot_token is not null and admin_chat_id is not null then
          perform net.http_post(
            url := 'https://api.telegram.org/bot' || bot_token || '/sendMessage',
            headers := jsonb_build_object('Content-Type', 'application/json'),
            body := jsonb_build_object(
              'chat_id', admin_chat_id,
              'text', case
                when job_stale then 'تنبيه منظّم النشر: مهمة cron للتذكيرات لم تعمل خلال آخر 5 دقائق.'
                else 'تنبيه منظّم النشر: تجاوزت أخطاء التذكير الحد خلال آخر 24 ساعة.'
              end
            ),
            timeout_milliseconds := 10000
          );
        end if;
      end if;
    end;
    $alert$;
  $job$
);
