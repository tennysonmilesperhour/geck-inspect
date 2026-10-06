-- Profile saves from the app failed with "permission denied for function
-- generate_referral_code" (6 Oct 2026).
--
-- The app saves a profile with an upsert (insert, or update when the
-- email already exists). Postgres runs BEFORE INSERT triggers before it
-- checks for that conflict, so profiles_set_referral_code fires on every
-- save, even for an existing row. Its function, set_default_referral_code(),
-- ran with the caller's rights and called generate_referral_code(), which
-- the 4 Sep referral grants made service-role only. Every Settings save
-- (and every other User.updateMyUserData call) failed for every member.
--
-- The trigger function now runs as its owner, so it can make a code for
-- any insert. generate_referral_code() stays closed to direct calls, and
-- a trigger function cannot be called over the API.
--
-- Idempotent; safe to re-apply.

alter function public.set_default_referral_code() security definer;
alter function public.set_default_referral_code() set search_path = public;
