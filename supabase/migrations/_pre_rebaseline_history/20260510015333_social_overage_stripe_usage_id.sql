-- Marker for "have we reported this month's overage to Stripe yet?"
-- Set by report-social-overage cron when it successfully creates a usage
-- record. Null means unreported; populated means we've billed it.
alter table public.social_post_usage
  add column if not exists stripe_usage_record_id text;

create index if not exists social_post_usage_unreported_overage_idx
  on public.social_post_usage(month_key)
  where overage_posts > 0 and stripe_usage_record_id is null;
