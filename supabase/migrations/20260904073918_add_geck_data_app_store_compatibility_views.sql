-- Keep the already-submitted Geck Inspect binary compatible. Its optional
-- training-data helper queries these four names in public, while new Geck Data
-- deployments address the full geck_data schema directly.
create view public.listing_images
with (security_invoker = true)
as select * from geck_data.listing_images;

create view public.external_reference_images
with (security_invoker = true)
as select * from geck_data.external_reference_images;

create view public.morph_taxonomy
with (security_invoker = true)
as select * from geck_data.morph_taxonomy;

create view public.market_listings
with (security_invoker = true)
as select * from geck_data.market_listings;

revoke all on public.listing_images, public.external_reference_images,
  public.morph_taxonomy, public.market_listings from public, anon, authenticated;
grant select on public.listing_images, public.external_reference_images,
  public.morph_taxonomy, public.market_listings to anon, authenticated, service_role;

-- PostgREST computed relationship used by the submitted app's nested select.
create function public.listing_images(public.market_listings)
returns setof public.listing_images
rows 10
stable
language sql
security invoker
set search_path = ''
as $$
  select images.*
  from public.listing_images as images
  where images.listing_id = $1.id
$$;

revoke all on function public.listing_images(public.market_listings) from public;
grant execute on function public.listing_images(public.market_listings)
  to anon, authenticated, service_role;

comment on view public.market_listings is
  'Read-only App Store compatibility view for the consolidated geck_data schema.';

notify pgrst, 'reload schema';
