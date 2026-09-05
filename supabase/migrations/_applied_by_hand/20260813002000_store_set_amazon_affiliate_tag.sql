-- =============================================================================
-- Store affiliate tag. Amazon Associates
-- =============================================================================
-- Applies the Amazon Associates tracking ID supplied for Geck Inspect and
-- appends it to active Amazon affiliate product URLs.
-- =============================================================================

update public.store_vendors
   set affiliate_default_tag = 'geckinspect09-20',
       notes = trim(both from concat_ws(
         ' ',
         notes,
         'Amazon Associates tracking ID configured: geckinspect09-20.'
       )),
       updated_date = now()
 where slug = 'amazon';

update public.store_products p
   set vendor_product_url = case
         when p.vendor_product_url ~ '(^|[?&])tag=' then
           regexp_replace(
             p.vendor_product_url,
             '([?&])tag=[^&]*',
             '\1tag=geckinspect09-20'
           )
         when position('?' in p.vendor_product_url) > 0 then
           p.vendor_product_url || '&tag=geckinspect09-20'
         else
           p.vendor_product_url || '?tag=geckinspect09-20'
       end,
       vendor_extra = coalesce(p.vendor_extra, '{}'::jsonb)
         || jsonb_build_object('needs_partner_tag', false, 'affiliate_tag_applied', true),
       updated_date = now()
  from public.store_vendors v
 where p.vendor_id = v.id
   and v.slug = 'amazon'
   and p.fulfillment_mode = 'affiliate_redirect'
   and p.vendor_product_url is not null;
