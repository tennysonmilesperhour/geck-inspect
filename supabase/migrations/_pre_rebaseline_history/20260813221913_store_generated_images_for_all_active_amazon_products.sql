-- =============================================================================
-- Store cleanup, generated images for active Amazon products
-- =============================================================================
-- Amazon Product Advertising API images are not wired yet. Until then, every
-- active affiliate product gets category artwork so the public store never
-- renders empty image wells.
-- =============================================================================

update public.store_products p
   set images = jsonb_build_array(jsonb_build_object(
         'url', 'data:image/svg+xml;base64,' || encode(convert_to(
           '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">'
           || '<rect width="800" height="800" fill="#020617"/>'
           || '<rect x="58" y="58" width="684" height="684" rx="42" fill="' || coalesce(case c.slug
             when 'diet' then '#16a34a'
             when 'decor' then '#0ea5e9'
             when 'enclosures' then '#f59e0b'
             when 'substrate' then '#65a30d'
             when 'humidity' then '#06b6d4'
             when 'hatchling' then '#f97316'
             when 'breeding' then '#64748b'
             when 'cleaning' then '#14b8a6'
             when 'health' then '#ef4444'
             when 'lighting' then '#eab308'
             when 'shipping' then '#8b5cf6'
             else '#10b981'
           end, '#10b981') || '" opacity="0.16"/>'
           || '<circle cx="620" cy="164" r="92" fill="' || coalesce(case c.slug
             when 'diet' then '#16a34a'
             when 'decor' then '#0ea5e9'
             when 'enclosures' then '#f59e0b'
             when 'substrate' then '#65a30d'
             when 'humidity' then '#06b6d4'
             when 'hatchling' then '#f97316'
             when 'breeding' then '#64748b'
             when 'cleaning' then '#14b8a6'
             when 'health' then '#ef4444'
             when 'lighting' then '#eab308'
             when 'shipping' then '#8b5cf6'
             else '#10b981'
           end, '#10b981') || '" opacity="0.35"/>'
           || '<path d="M201 443c43-94 132-149 241-137 81 9 145 54 174 119-58-27-114-26-168 2-68 35-129 41-247 16z" fill="#f8fafc" opacity="0.82"/>'
           || '<circle cx="505" cy="362" r="14" fill="#020617"/>'
           || '<text x="400" y="560" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="64" font-weight="800" fill="#f8fafc">' || upper(coalesce(c.name, 'Supply')) || '</text>'
           || '<text x="400" y="624" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="30" fill="#cbd5e1">Geck Inspect pick</text>'
           || '</svg>', 'UTF8'), 'base64'),
         'alt', p.name,
         'is_primary', true
       )),
       vendor_extra = coalesce(p.vendor_extra, '{}'::jsonb)
         || jsonb_build_object('image_is_generated_category_art', true),
       updated_date = now()
  from public.store_categories c
 where p.category_id = c.id
   and p.status = 'active'
   and jsonb_array_length(coalesce(p.images, '[]'::jsonb)) = 0;
