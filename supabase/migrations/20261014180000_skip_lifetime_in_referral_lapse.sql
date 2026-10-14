-- Lifetime members are not moved to Free when a referral month ends.
--
-- expire_referral_grants() runs daily from pg_cron. It returns a lapsed
-- referral Keeper month to Free. A lifetime purchase clears
-- stripe_subscription_id and keeps membership_billing_cycle = 'lifetime'.
-- If that row's subscription_status is anything other than active,
-- trialing, past_due, or grandfathered, the old query treated the member
-- like a referral grant and could set a lifetime Keeper back to Free.
--
-- This replacement does two things:
--   1. Clears a finished referral window on a lifetime row without
--      changing the tier and without sending the "your free month ended"
--      notice.
--   2. Leaves lifetime rows out of the downgrade loop, including in the
--      update itself.
--
-- Not applied to production by this commit. Apply it with the Supabase
-- migration tool after review. CREATE OR REPLACE keeps the existing
-- execute grants (service_role only).

create or replace function public.expire_referral_grants()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer := 0;
  r record;
begin
  perform set_config('geck.referral_bypass', 'on', true);

  update public.profiles
     set referral_grant_until = null,
         updated_date = now()
   where referral_grant_until is not null
     and referral_grant_until < now()
     and membership_billing_cycle = 'lifetime';

  for r in
    select p.email
      from public.profiles p
     where p.referral_grant_until is not null
       and p.referral_grant_until < now()
       and p.stripe_subscription_id is null
       and coalesce(p.membership_billing_cycle, '') <> 'lifetime'
       and coalesce(p.subscription_status, '') not in ('active', 'trialing', 'past_due', 'grandfathered')
       and not exists (
         select 1
           from public.revenuecat_entitlements e
           join auth.users u on u.id = e.app_user_id
          where lower(u.email) = lower(p.email)
            and e.is_active = true
            and (e.expires_at is null or e.expires_at > now())
       )
  loop
    update public.profiles
       set membership_tier = case when membership_tier = 'keeper' then 'free' else membership_tier end,
           referral_grant_until = null,
           updated_date = now()
     where email = r.email
       and coalesce(membership_billing_cycle, '') <> 'lifetime';
    if not found then
      continue;
    end if;

    insert into public.notifications (user_email, type, content, link, metadata, is_read, created_by)
    values (
      r.email, 'referral_grant_ended',
      'Your free month of Keeper from a referral has ended. Refer another crested gecko keeper to earn the next one, or keep Keeper going from the Membership page.',
      '/Membership', jsonb_build_object('source', 'cron'), false, r.email
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.expire_referral_grants() is
  'Daily job. Returns lapsed referral Keeper months to Free. Skips lifetime members, live Stripe subscribers, grandfathered accounts, and active app-store entitlements.';
