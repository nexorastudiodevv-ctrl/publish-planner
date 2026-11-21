create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- أعد إنشاء المهمة بنفس الاسم عند تكرار تشغيل هذا الملف.
select cron.unschedule(jobid)
from cron.job
where jobname = 'send-reminders-every-minute';

select cron.schedule(
  'send-reminders-every-minute',
  '* * * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'supabase_url'
      ) || '/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'cron_secret'
        )
      ),
      body := jsonb_build_object('source', 'pg_cron'),
      timeout_milliseconds := 120000
    );
  $job$
);
