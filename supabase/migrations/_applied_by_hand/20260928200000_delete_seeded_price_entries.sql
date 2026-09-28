-- Delete the seeded Market Pricing "sales" (Tennyson's OK, 28 Sep 2026).
--
-- public.morph_price_entries held 24 rows, all inserted in one batch on
-- 13 Apr 2026 with source 'curated_guide', no author, backdated sale dates
-- from 10 Jan to 18 Mar. The Market Pricing page showed them as recent
-- sales, and the public Quality Scale page told keepers to cross-check
-- their tier against them. Market Pricing now shows asking-price bands from
-- the scraped MorphMarket listings instead; this table keeps only sales
-- that people log themselves.
--
-- Applied by hand with execute_sql (data only, no schema change).

delete from public.morph_price_entries
 where source = 'curated_guide'
   and created_by is null
   and created_date::date = '2026-04-13';

-- To restore the 24 rows exactly as they were:
--
-- insert into public.morph_price_entries
--   (id, sex, notes, source, verified, sale_date, base_morph, created_by, sale_price,
--    age_category, created_date, is_anonymous, morph_traits, submitted_by, updated_date, pattern_grade)
-- select id, sex, null, 'curated_guide', true, sale_date, base_morph, null, sale_price,
--        age_category, '2026-04-13 23:54:36.50476+00', true, null, null, '2026-04-13 23:54:36.50476+00', pattern_grade
-- from (values
--   ('b374ef0a-6fde-4ce1-ac6d-a3ea798472ce'::uuid, 'male',   '2026-01-10'::date, 'Flame',              40, 'hatchling', 'pet'),
--   ('19b64f50-221d-49d0-ae9e-991dde9157a5'::uuid, 'female', '2026-01-15'::date, 'Harlequin',          75, 'hatchling', 'pet'),
--   ('e4831013-cb93-4f40-ab42-b3cc78ab3ddd'::uuid, 'female', '2026-01-18'::date, 'Dalmatian',          80, 'hatchling', 'pet'),
--   ('35c82d7d-559d-4654-bf0f-855515a95563'::uuid, 'male',   '2026-01-20'::date, 'Harlequin',          50, 'hatchling', 'pet'),
--   ('ece7e1c1-8538-4931-8adb-26a404906d1f'::uuid, 'male',   '2026-01-22'::date, 'Tiger',              60, 'hatchling', 'pet'),
--   ('1d1b997b-8f7d-4328-87c9-3ff6077e0e7e'::uuid, 'female', '2026-01-25'::date, 'Lilly White',       350, 'hatchling', 'pet'),
--   ('3152a6af-f364-4228-bb32-492daae902d1'::uuid, 'male',   '2026-01-30'::date, 'Lilly White',       300, 'hatchling', 'pet'),
--   ('0d06f896-fdc8-4f72-b6bf-f9130c118b75'::uuid, 'female', '2026-02-05'::date, 'Axanthic',          350, 'juvenile',  'breeder'),
--   ('28490787-d395-415c-b04b-cdeb0ce1aed5'::uuid, 'female', '2026-02-10'::date, 'Harlequin',         250, 'adult',     'breeder'),
--   ('bffc829f-43f6-46ec-a6a7-678d1a5be87b'::uuid, 'female', '2026-02-12'::date, 'Dalmatian',         200, 'adult',     'breeder'),
--   ('7128db60-3e01-43bc-97d6-0343517ef28f'::uuid, 'female', '2026-02-15'::date, 'Harlequin',         600, 'adult',     'high_end'),
--   ('bba2a600-e01f-4623-8e45-2b5f4b9a275b'::uuid, 'female', '2026-02-18'::date, 'Pinstripe',         200, 'adult',     'breeder'),
--   ('0fb2eff7-6c7e-45a0-9c3a-cffae25a94cc'::uuid, 'male',   '2026-02-20'::date, 'Extreme Harlequin', 400, 'subadult',  'breeder'),
--   ('6aa62343-aebe-4ff0-baa5-8158535690f3'::uuid, 'female', '2026-02-22'::date, 'Flame',             150, 'adult',     'breeder'),
--   ('3d724b71-ab32-4451-bc75-eecf65538bad'::uuid, 'female', '2026-02-25'::date, 'Phantom Pinstripe', 275, 'subadult',  'breeder'),
--   ('f4b6bdda-feca-477a-b5c1-5f9d3fed4c31'::uuid, 'female', '2026-02-28'::date, 'Lilly White',       800, 'adult',     'breeder'),
--   ('0adc2cae-28a8-4f8c-ad56-c971053c0009'::uuid, 'female', '2026-03-01'::date, 'Extreme Harlequin', 1200, 'adult',    'high_end'),
--   ('9f0b4e1f-3ae4-4773-9ce6-1ca47dc381d4'::uuid, 'female', '2026-03-02'::date, 'Cream on Cream',    300, 'adult',     'breeder'),
--   ('658cd4b0-5eb6-4850-b63c-f138d56e90aa'::uuid, 'female', '2026-03-05'::date, 'Extreme Harlequin', 2500, 'adult',    'investment'),
--   ('9f8b0e27-2b6e-47d4-8af0-900554f45856'::uuid, 'female', '2026-03-08'::date, 'Dalmatian',         500, 'adult',     'high_end'),
--   ('05ef4a0f-d522-4fe6-a7a9-c99366f19b49'::uuid, 'female', '2026-03-10'::date, 'Lilly White',      1500, 'adult',     'high_end'),
--   ('e6aa4e27-fb24-4e7b-bbba-65018f235da6'::uuid, 'female', '2026-03-12'::date, 'Axanthic',          600, 'adult',     'high_end'),
--   ('8ca4d1ac-530d-412a-a66e-c60c02bfa77b'::uuid, 'female', '2026-03-15'::date, 'Pinstripe',         450, 'adult',     'high_end'),
--   ('4586facf-a6cf-4ebe-9bf9-237f05aff1e8'::uuid, 'female', '2026-03-18'::date, 'Tricolor',          800, 'adult',     'high_end')
-- ) as v(id, sex, sale_date, base_morph, sale_price, age_category, pattern_grade);
