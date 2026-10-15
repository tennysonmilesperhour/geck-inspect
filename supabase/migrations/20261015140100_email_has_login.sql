-- email_has_login: does this email belong to an account that can sign in?
--
-- Additive only. Safe to run more than once.
--
-- About 83 of the 147 profiles were imported from the old platform and
-- have no sign-in account (no auth.users row), and 82 of them still had
-- email notifications switched on. In the 30 days to 15 Oct 2026, 109 of
-- 194 notifications (weekly digests, hatch alerts, weigh-in reminders)
-- were addressed to people who cannot log in or act on them. That hurts
-- the sending domain's reputation and is mail nobody asked for.
--
-- send-email calls this before sending a notification and skips the
-- address when it returns false. Transactional mail (invites, transfers,
-- guides, receipts) does not go through send-email and is not affected.
-- Until this is applied send-email keeps sending as before, so the
-- function and this migration can be deployed in either order.
--
-- profiles.id is not the auth user id for most members, so the match is
-- on the email address, case-insensitively, the way sign-in treats it.
-- Only the service role may call it: it answers "is this address a
-- member", which must not be open to the public.

create or replace function public.email_has_login(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where lower(u.email) = lower(trim(p_email))
  );
$$;

revoke all on function public.email_has_login(text) from public, anon, authenticated;
grant execute on function public.email_has_login(text) to service_role;
