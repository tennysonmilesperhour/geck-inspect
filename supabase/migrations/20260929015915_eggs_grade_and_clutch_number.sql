-- The egg card, the egg edit dialog, the Hatchery view, Image Import and
-- CSV import all read or write eggs.grade, and CSV import writes
-- eggs.clutch_number, but neither column existed. PostgREST rejects a write
-- that names an unknown column, so rating an egg, saving any change in the
-- egg edit dialog, and creating eggs from Image Import or CSV import all
-- failed (found 29 Sep 2026).
alter table public.eggs
  add column if not exists grade text,
  add column if not exists clutch_number integer;

comment on column public.eggs.grade is 'Keeper''s egg rating: A+, A, B, C or D.';
comment on column public.eggs.clutch_number is 'Clutch number from a CSV import, when the sheet had one.';
