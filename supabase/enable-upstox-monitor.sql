-- Run after migration 003. Enable pg_cron, pg_net and Vault in Supabase first.
-- Add these TWO secrets in Supabase Vault using the dashboard:
-- secondpage_monitor_url    = https://YOUR-APP.vercel.app/api/monitor
-- secondpage_monitor_secret = the MONITOR_SECRET from your server environment
-- Do not use your Upstox or service-role token as the scheduler secret.
create or replace function public.dispatch_upstox_monitor() returns void language plpgsql security definer set search_path='' as $$
declare endpoint text; bearer text; local_time timestamp := clock_timestamp() at time zone 'Asia/Kolkata';
begin
 -- Holiday/session checks are performed by the authenticated provider in Next.js.
 if extract(isodow from local_time)>5 or local_time::time<'09:15'::time or local_time::time>='15:30'::time then return; end if;
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='secondpage_monitor_url';
 select decrypted_secret into bearer from vault.decrypted_secrets where name='secondpage_monitor_secret';
 if endpoint is null or endpoint !~ '^https://' or bearer is null then raise exception 'Set the monitor URL and secret in Vault first.'; end if;
 perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Authorization','Bearer '||bearer,'Content-Type','application/json'),body:='{}'::jsonb,timeout_milliseconds:=10000);
end; $$;
revoke all on function public.dispatch_upstox_monitor() from public,anon,authenticated,service_role;
select cron.schedule('secondpage-upstox-monitor','5 seconds','select public.dispatch_upstox_monitor();');
select cron.schedule('secondpage-upstox-log-cleanup','17 3 * * *',
 $$delete from cron.job_run_details where jobid in (select jobid from cron.job where jobname in ('secondpage-upstox-monitor','secondpage-upstox-log-cleanup')) and end_time < now()-interval '1 day';$$);
-- Verify HTTP results in net._http_response as well as Cron history: queueing an HTTP
-- request is not proof that /api/monitor completed successfully.
-- Stop: select cron.unschedule('secondpage-upstox-monitor');
