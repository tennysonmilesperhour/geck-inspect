-- =============================================================================
-- Store launch pass. Amazon-only affiliate products
-- =============================================================================
-- We can publish Amazon Associates products before setting up the other
-- reptile-company partner programs. This keeps Chewy/Pangea/Repashy/Dubia/etc.
-- draft, turns on the public Supplies area, and activates Amazon rows that
-- already have vendor_product_url populated.
--
-- Important: add the real Amazon Associates tracking ID to
-- store_vendors.affiliate_default_tag and replace/search-tag these URLs before
-- treating this as revenue-complete. The public links work now, but commission
-- requires the Associates tag.
-- =============================================================================

update public.app_settings
   set value = 'true'::jsonb,
       is_public = true,
       updated_at = now()
 where key = 'store_enabled';

insert into public.app_settings (key, value, is_public, description)
select
  'store_enabled',
  'true'::jsonb,
  true,
  'Master kill-switch for the entire Supplies tab.'
where not exists (
  select 1 from public.app_settings where key = 'store_enabled'
);

update public.store_vendors
   set notes = trim(both from concat_ws(
         ' ',
         notes,
         'Amazon-only launch enabled. Set affiliate_default_tag to the Amazon Associates tracking ID, then replace product search URLs with final tagged product URLs as products are reviewed.'
       )),
       updated_date = now()
 where slug = 'amazon';

-- Keep non-Amazon affiliate rows out of the public store until their own
-- partner programs are approved and tagged.
update public.store_products p
   set status = 'draft',
       updated_date = now()
  from public.store_vendors v
 where p.vendor_id = v.id
   and p.fulfillment_mode = 'affiliate_redirect'
   and v.slug <> 'amazon'
   and p.status = 'active';

-- Publish only Amazon-backed affiliate rows. Rows still carry
-- vendor_extra.needs_partner_tag so Admin > Store can keep nagging until the
-- actual Associates tag/product URL review is complete.
update public.store_products p
   set status = 'active',
       is_featured = case
         when p.slug in (
           'aff-inkbird-itc308',
           'aff-govee-hygrometer',
           'aff-arcadia-shadedweller-arboreal-prot5',
           'aff-aws-gram-scale',
           'aff-portable-photo-light-box',
           'aff-cork-bark-flats'
         ) then true
         else p.is_featured
       end,
       updated_date = now()
  from public.store_vendors v
 where p.vendor_id = v.id
   and v.slug = 'amazon'
   and p.fulfillment_mode = 'affiliate_redirect'
   and p.vendor_product_url is not null;
