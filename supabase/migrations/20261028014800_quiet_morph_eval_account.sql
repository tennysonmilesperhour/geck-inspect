-- The Morph ID evaluation account (app_metadata morph_eval = true, created by
-- scripts/morph-id-eval/evalAccount.mjs for the accuracy test and the daily
-- canary) had Weekly Gecko Notes and notification emails on. Its address has
-- no mailbox, so each Monday's note sat in Resend's retry queue for hours and
-- then bounced: 9 of the 13 delayed emails and one of the two bounces on
-- 26 Oct 2026. The three Apple Review accounts were already off.
--
-- Turns both email switches off for every evaluation account. Data only, no
-- schema change. Safe to run more than once (a second run matches nothing).
-- evalAccount.mjs now keeps them off when it creates or reuses the account.

update public.profiles p
   set email_weekly_notes_enabled = false,
       email_notifications_enabled = false
 where (p.email_weekly_notes_enabled is distinct from false
        or p.email_notifications_enabled is distinct from false)
   and exists (
         select 1 from auth.users u
          where lower(u.email) = lower(p.email)
            and u.raw_app_meta_data ->> 'morph_eval' = 'true'
       );
