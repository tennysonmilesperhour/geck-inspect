-- Drop the dead Social Media Manager referral bonus function (5 Sep 2026).
--
-- award_referral_signup_bonus() was written for a referral schema that
-- never reached production and was called by stripe-webhook on every
-- first paid invoice, failing each time inside a try/catch. The webhook
-- now calls award_referral_reward() instead, so nothing references this
-- function. The social_referral_bonuses table stays: it is empty,
-- harmless, and still mapped by the entity layer.
--
-- Idempotent.

drop function if exists public.award_referral_signup_bonus(uuid, text, text, text);
