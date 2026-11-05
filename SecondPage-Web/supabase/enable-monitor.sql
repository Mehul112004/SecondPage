-- Run AFTER migration 002 in the Supabase SQL editor.
-- Requires the pg_cron integration to be enabled in Supabase.
-- Executes only synthetic practice quotes. No external API calls or tick storage.
select cron.schedule('secondpage-brackets', '5 seconds', 'select public.monitor_brackets();');
-- Keep scheduler logs bounded (not price data).
select cron.schedule('secondpage-cron-log-cleanup', '17 3 * * *',
 $$delete from cron.job_run_details where jobid in (select jobid from cron.job where jobname in ('secondpage-brackets','secondpage-cron-log-cleanup')) and end_time < now() - interval '1 day';$$);
-- Stop monitoring: select cron.unschedule('secondpage-brackets');
