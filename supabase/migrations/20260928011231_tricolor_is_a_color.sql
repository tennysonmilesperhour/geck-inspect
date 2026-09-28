-- Tricolor is a color description, not a pattern. MorphMarket's Morphpedia,
-- Pangea and Moon Valley all describe it as three distinct colors in roughly
-- equal amounts (base plus two pattern colors), carried on a Harlequin or a
-- Pinstripe. Breeders tag it next to the pattern ("Tricolor Harlequin").
-- Morph ID treated it as one of 23 pattern classes, so a photo tagged only
-- "Tricolor" taught retrieval a pattern the breeder never named.
--
-- 1. The taxonomy files Tri-color as a secondary trait. The training view
--    then lists it under secondary_traits instead of primary_morph_ids.
-- 2. Scraped photos: tricolor leaves training_meta.breeder_patterns and
--    joins secondary_traits. primary_morph is re-picked from the remaining
--    breeder patterns. A listing tagged only Tricolor has no pattern from the
--    breeder, so primary_morph becomes null and it leaves pattern retrieval
--    (it keeps the color tag). The old label is kept in
--    training_meta.primary_morph_before_tricolor_move.
-- 3. The GGSC 2024 "Best Tricolor" hero anchor becomes a secondary-trait
--    anchor, matching how base-color and genetic anchors already work.
-- 4. Other photos labeled tricolor: one owner tagged Pinstripe as well, so it
--    becomes pinstripe; the rest get a null pattern plus the tricolor tag.

update geck_data.crested_morph_taxonomy
   set trait_kind = 'secondary_trait'
 where canonical_id = 'tricolor';

with s as (
  select g.id,
         g.primary_morph as old_pm,
         coalesce((select jsonb_agg(p order by p)
                     from jsonb_array_elements_text(g.training_meta->'breeder_patterns') p
                    where p <> 'tricolor'), '[]'::jsonb) as pats
    from public.gecko_images g
   where g.training_meta->'breeder_patterns' ? 'tricolor'
), n as (
  select s.*,
         geck_data.pick_primary_morph(array(select jsonb_array_elements_text(s.pats))) as new_pm
    from s
)
update public.gecko_images g
   set training_meta = g.training_meta
         || jsonb_build_object('breeder_patterns', n.pats)
         || case when n.new_pm is distinct from n.old_pm
                 then jsonb_build_object('primary_morph_before_tricolor_move', n.old_pm)
                 else '{}'::jsonb end,
       secondary_traits = case when coalesce(g.secondary_traits, '[]'::jsonb) ? 'tricolor'
                               then g.secondary_traits
                               else coalesce(g.secondary_traits, '[]'::jsonb) || '["tricolor"]'::jsonb end,
       primary_morph = n.new_pm
  from n
 where n.id = g.id;

update public.gecko_images g
   set training_meta = g.training_meta
         || jsonb_build_object('primary_morph_before_tricolor_move', g.primary_morph)
         || case when g.training_meta->>'verification_tier' = 'hero_anchor'
                  and g.training_meta->>'anchor_category' = 'primary_morph'
                 then jsonb_build_object('anchor_category', 'secondary_trait')
                 else '{}'::jsonb end,
       secondary_traits = case when coalesce(g.secondary_traits, '[]'::jsonb) ? 'tricolor'
                                 or coalesce(g.secondary_traits, '[]'::jsonb) ? 'Tricolor'
                               then g.secondary_traits
                               else coalesce(g.secondary_traits, '[]'::jsonb) || '["tricolor"]'::jsonb end,
       primary_morph = case when coalesce(g.secondary_traits, '[]'::jsonb) ? 'Pinstripe'
                            then 'pinstripe' else null end
 where g.primary_morph = 'tricolor';
