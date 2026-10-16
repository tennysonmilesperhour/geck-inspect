-- Promote (social posting) is retired in round 3 of the review plan (E3
-- item 23; see docs/planning/retired-features-2026-10.md). Its monthly
-- overage-billing job, which posts usage to Stripe through the
-- report-social-overage function, has nothing left to bill, and it still
-- calls Stripe's legacy usage-records API, which Stripe has removed. So the
-- job is unscheduled here. The function itself stays deployed and does
-- nothing unless called.
--
-- To bring it back with Promote, reschedule it as migration
-- 20260930052140_overage_billing_cron_sends_secret.sql did, after moving the
-- function to Stripe's billing meters.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'monthly-overage-billing') then
    perform cron.unschedule('monthly-overage-billing');
  end if;
end
$$;
