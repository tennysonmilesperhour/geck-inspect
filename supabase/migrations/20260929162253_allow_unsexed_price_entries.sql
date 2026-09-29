-- Market Pricing's "Log a sale" form offers Unsexed (most hatchlings
-- sell unsexed, and the trait price table already has an unsexed band),
-- but this check allowed only male or female, so those sales failed.
alter table public.morph_price_entries
  drop constraint if exists morph_price_entries_sex_check;
alter table public.morph_price_entries
  add constraint morph_price_entries_sex_check
  check (sex = any (array['male'::text, 'female'::text, 'unsexed'::text]));
