-- report-social-overage now checks its caller (service-role key, the
-- notifications dispatch secret, or an admin). The monthly job sent no
-- credentials at all, so under the old gateway JWT check it was refused
-- every month. It now sends the same Vault secret the notifications
-- trigger uses, read at run time so the value never sits in cron.job.
-- The timeout was 1 second, shorter than a Stripe round trip.
select cron.schedule(
  'monthly-overage-billing',
  '0 2 1 * *',
  $cmd$
select net.http_post(
  url := 'https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/report-social-overage',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'notification_service_role_key' limit 1
    )
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 60000
);
$cmd$
);
