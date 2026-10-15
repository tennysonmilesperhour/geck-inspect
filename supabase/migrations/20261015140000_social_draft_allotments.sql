-- Monthly allowance for Promote drafting (generate-social-post).
--
-- Additive only. Safe to run more than once.
--
-- generate-social-post calls the AI model and had only a per-post cap of
-- 10 tries, so starting a new draft post reset it and one account could
-- run up unlimited spend. The function now takes one `social_draft`
-- credit per call through consume_feature_credit, and gives it back when
-- the call produces no drafts. consume_feature_credit refuses a feature
-- with no row here ('unknown_feature'), so apply this BEFORE deploying
-- the new generate-social-post.
--
-- The numbers are the plan's monthly posts (monthlySocialPosts in
-- src/lib/tierLimits.js: 1, 4, 12, 30) times the 10 tries each post
-- already allows, so no member loses anything the plan page promises.
-- Change them here (or with an update on this table) to tighten.

insert into public.feature_credit_allotments (feature, tier, included)
values
  ('social_draft', 'free', 10),
  ('social_draft', 'keeper', 40),
  ('social_draft', 'breeder', 120),
  ('social_draft', 'enterprise', 300)
on conflict (feature, tier) do update set included = excluded.included;
