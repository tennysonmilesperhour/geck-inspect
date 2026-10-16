-- Outside reference photos: only licences that allow commercial use are
-- readable through the API (16 October 2026).
--
-- geck_data.external_reference_images holds photos from outside sources
-- (iNaturalist) that the Morph Guide shows on each morph page. On 16
-- October production held 30 crested gecko rows: 26 CC BY-NC, 2 CC BY-NC-SA
-- and 2 CC BY, plus 12 leopard gecko rows with no licence. Geck Inspect
-- sells plans, so a NonCommercial photo, or one with no licence, cannot be
-- shown on it (adversarial review, October 2026).
--
-- The app now asks only for these licences and checks them again on arrival
-- (src/lib/imageLicenses.js). This policy makes the same rule hold in the
-- database, so an app copy that is still open from before the change, or
-- anyone calling the public API directly, gets only the photos we may show.
-- The rows themselves stay (the importer and the service role still read
-- them), so the change is undone by restoring the old policy.
--
-- The only reader seen in production is the Morph Guide's own query (anon,
-- crested gecko rows by morph), so nothing else loses data it uses.
--
-- Safe with either app version: the old app asks for every licence and now
-- receives the commercial ones only; the new app asks for the commercial
-- ones only. The list matches COMMERCIAL_USE_LICENSES in
-- src/lib/imageLicenses.js (public domain, CC BY, CC BY-SA). NoDerivatives
-- licences are left out because the page crops photos to squares.

drop policy if exists "public read external_reference_images"
  on geck_data.external_reference_images;
drop policy if exists "public read commercial-use external_reference_images"
  on geck_data.external_reference_images;

create policy "public read commercial-use external_reference_images"
  on geck_data.external_reference_images
  for select
  using (license in ('cc0', 'pdm', 'cc-by', 'cc-by-sa'));

comment on policy "public read commercial-use external_reference_images"
  on geck_data.external_reference_images is
  'Only photos whose licence allows commercial use (public domain, CC BY, CC BY-SA) are readable. Matches COMMERCIAL_USE_LICENSES in src/lib/imageLicenses.js. 16 Oct 2026.';
