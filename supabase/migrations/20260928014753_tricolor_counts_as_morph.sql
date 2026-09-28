-- Tricolor counts as a Morph ID answer again (Tennyson's call, 28 Sep).
-- It is named for its colors, but it is one of the most common crested gecko
-- listings and breeders sell it as its own morph, so Morph ID should be able
-- to answer "Tricolor". This reverses 20260928011231_tricolor_is_a_color,
-- with one thing kept: photos the breeder tagged Tricolor keep the tricolor
-- tag in secondary_traits, so a "Tricolor Harlequin" carries both labels and
-- the evaluation accepts either.

update geck_data.crested_morph_taxonomy
   set trait_kind = 'primary_morph'
 where canonical_id = 'tricolor';

-- Scraped photos: rebuild the breeder's pattern list from their own tags and
-- re-pick the primary label (420 photos return to tricolor).
with s as (
  select g.id,
    (select array_agg(distinct c.canonical_id order by c.canonical_id)
       from jsonb_array_elements_text(g.training_meta->'scraper_traits') t
       join geck_data.crested_morph_taxonomy c on c.canonical_name = t
      where c.trait_kind = 'primary_morph' and c.canonical_id is not null) as pms
  from public.gecko_images g
  where g.created_by is null
    and g.training_meta ? 'scraper_traits'
    and (g.secondary_traits ? 'tricolor' or g.training_meta ? 'primary_morph_before_tricolor_move')
)
update public.gecko_images g
   set training_meta = (g.training_meta - 'primary_morph_before_tricolor_move')
         || jsonb_build_object('breeder_patterns', to_jsonb(s.pms)),
       primary_morph = geck_data.pick_primary_morph(s.pms)
  from s
 where s.id = g.id
   and s.pms is not null;

-- The GGSC 2024 "Best Tricolor" show winner and the owner-labeled photos get
-- their original label back.
update public.gecko_images g
   set primary_morph = g.training_meta->>'primary_morph_before_tricolor_move',
       training_meta = (g.training_meta - 'primary_morph_before_tricolor_move')
         || case when g.training_meta->>'verification_tier' = 'hero_anchor'
                  and g.training_meta->>'anchor_category' = 'secondary_trait'
                 then jsonb_build_object('anchor_category', 'primary_morph')
                 else '{}'::jsonb end
 where g.training_meta ? 'primary_morph_before_tricolor_move';
