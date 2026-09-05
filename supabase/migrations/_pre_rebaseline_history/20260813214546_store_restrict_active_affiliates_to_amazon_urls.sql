-- =============================================================================
-- Store cleanup, active affiliate rows must point to Amazon
-- =============================================================================
-- Some early seed rows used the Amazon vendor as a temporary placeholder while
-- pointing at other reptile-company URLs. For the Amazon-only launch, keep only
-- actual amazon.com destinations active.
-- =============================================================================

update public.store_products p
   set status = 'draft',
       updated_date = now()
  from public.store_vendors v
 where p.vendor_id = v.id
   and p.fulfillment_mode = 'affiliate_redirect'
   and p.status = 'active'
   and (
     v.slug <> 'amazon'
     or p.vendor_product_url is null
     or p.vendor_product_url !~* '^https://([^/]+\.)?amazon\.com/'
   );

update public.store_products p
   set status = 'active',
       vendor_product_url = case
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
   and p.vendor_product_url ~* '^https://([^/]+\.)?amazon\.com/';
