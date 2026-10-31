-- Which male an egg came from, when it is not the breeding plan's male.
-- Comprehensive review, Part C15 item 4 and Part E (a possible prior sire
-- on an egg or clutch).
--
-- Before: an egg carried only its breeding plan, so its father was always
-- the plan's sire. A crested gecko female can store sperm for months, so
-- after a pair change the first clutches with the new male can be from
-- the earlier one. The hatchling then got the new male as its sire, and
-- the passport printed that lineage.
--
-- After: two optional columns on eggs. A clutch is the eggs of one plan
-- with the same lay date, and the app writes both columns on every egg of
-- the clutch together.
--
--   sire_id           the male this egg is recorded as coming from, when
--                     the breeder says it is not the plan's sire (for
--                     example the dam's earlier pairing). Empty: the
--                     plan's sire, as before.
--   possible_sire_id  another male that may be the father, when the
--                     breeder is not sure. Empty: none.
--
-- When the egg hatches, the hatchling's sire is sire_id, or the plan's
-- sire when it is empty (src/lib/hatchEgg.js); with possible_sire_id set,
-- the hatchling's genetics notes say the sire is not confirmed, and the
-- passport shows those notes next to the lineage. Changing a clutch's
-- sire after it hatched moves the linked hatchlings' sire too
-- (src/lib/eggSire.js).
--
-- Existing eggs keep both columns empty, which means exactly what they
-- meant before (the plan's sire). Nothing is rewritten.
--
-- No foreign key, like breeding_plans.sire_id and geckos.sire_id: a male
-- that is later deleted must not take the egg record with it. The eggs
-- policies (20261015120000_ownership_checks.sql) already limit who can
-- write an egg to the plan's owner.
--
-- Safe for the app that is already open: two new nullable columns that no
-- current screen writes. Safe to run more than once: add column if not
-- exists.

alter table public.eggs add column if not exists sire_id text;
alter table public.eggs add column if not exists possible_sire_id text;

comment on column public.eggs.sire_id is
  'The male this egg came from when it is not the breeding plan''s sire (for example a female that stored sperm from an earlier pairing). Empty: the plan''s sire. The app writes it on every egg of a clutch (same plan, same lay date) and the hatchling takes it as its sire.';
comment on column public.eggs.possible_sire_id is
  'Another male that may have fathered this egg, when the breeder is not sure. Empty: none. The hatchling''s genetics notes then say the sire is not confirmed.';
