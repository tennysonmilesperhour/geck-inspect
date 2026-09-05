-- Referral functions: explicit execute grants (4 Sep 2026, follow-up).
--
-- Supabase's default privileges hand EXECUTE on every new public function
-- to anon and authenticated, and "revoke ... from public" does not undo
-- those direct grants. The referral_keeper_month migration only revoked
-- from public, so award_referral_reward() was callable by any signed-in
-- member over the REST API. That would let someone hand a referrer a free
-- Keeper month without any payment. Only stripe-webhook (service role)
-- may award; only signed-in members may attribute; the rest are internal.
--
-- Idempotent; safe to re-apply.

revoke all on function public.award_referral_reward(text, text, text) from public, anon, authenticated;
grant execute on function public.award_referral_reward(text, text, text) to service_role;

revoke all on function public.expire_referral_grants() from public, anon, authenticated;
grant execute on function public.expire_referral_grants() to service_role;

revoke all on function public.generate_referral_code() from public, anon, authenticated;
revoke all on function public.set_default_referral_code() from public, anon, authenticated;
revoke all on function public.protect_profile_referral_columns() from public, anon, authenticated;

revoke all on function public.apply_referral_code(text) from public, anon;
grant execute on function public.apply_referral_code(text) to authenticated, service_role;
