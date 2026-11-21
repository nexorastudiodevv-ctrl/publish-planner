select cron.unschedule(jobid)
from cron.job
where jobname = 'send-reminders-every-minute';
