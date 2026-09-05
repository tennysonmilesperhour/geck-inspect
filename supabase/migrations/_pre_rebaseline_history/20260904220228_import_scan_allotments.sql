-- Import scan credits per tier.
--
-- The recognize-import-data edge function (spreadsheet and screenshot
-- import via Claude vision) used to run with no auth and no metering, so anyone
-- who found the URL could burn Anthropic API spend for free. It now consumes
-- one import_scan credit per batch through consume_feature_credit, and
-- this seeds how many scans each tier gets per period.
--
-- Free and Keeper get none: image import is a Breeder and Enterprise
-- feature in the plan table. Applied to production by hand as
-- import_scan_allotments on 2026-09-05.

insert into public.feature_credit_allotments (feature, tier, included)
values
  ('import_scan', 'free', 0),
  ('import_scan', 'keeper', 0),
  ('import_scan', 'breeder', 20),
  ('import_scan', 'enterprise', 200)
on conflict (feature, tier) do update set included = excluded.included;
