# Morph ID test set

`test-split-breeder-tags.jsonl` holds 195 of the 220 MorphMarket listings in
the held-out test split (381 photos). The other 25 were tagged only Tricolor,
which is a color description rather than a pattern, so they have no pattern to
grade against. Each row is one gecko:

- `image_urls`: every photo of that listing
- `expected_primary_morph`: the pattern our import picks from the breeder's tags
- `accepted_morphs`: every pattern the breeder tagged

The breeders labeled these animals themselves when listing them for sale.
Since 28 Sep 2026 the retrieval step (`morph_visual_neighbors`) skips the test
split, so Morph ID cannot look up the same gecko while being graded.

## Run it

```
pnpm eval:morph-id scripts/morph-id-eval/test-split-breeder-tags.jsonl > morph-id-report.json
```

Needs `MORPH_ID_ACCESS_TOKEN`, `SUPABASE_ANON_KEY` and `SUPABASE_URL` (see the
script's usage text). The report has two kinds of accuracy:

- `overall_top1_accuracy`: first answer equals the single picked pattern
- `overall_top1_breeder_tag`: first answer is any pattern the breeder tagged

The second is the fair headline number. 58 of the 195 geckos carry more than
one pattern tag (most often Dalmatian plus Super Dalmatian, or Harlequin plus
a Pinstripe), and naming either one agrees with the breeder.

## Rebuild the file

Run in the Supabase SQL editor and save the output column as the `.jsonl`:

```sql
with t as (
  select training_meta->>'geck_data_listing_id' as listing_id,
         jsonb_agg(image_url order by (image_embedding is null), id) as urls,
         min(primary_morph) as pm,
         (array_agg(training_meta->'breeder_patterns'))[1] as bp
    from public.gecko_images
   where created_by is null
     and training_meta->>'geck_data_split' = 'test'
     and primary_morph is not null and image_url is not null
   group by 1
)
select string_agg(jsonb_build_object(
         'id', 'listing:' || listing_id,
         'image_urls', urls,
         'expected_primary_morph', pm,
         'accepted_morphs', coalesce(bp, '[]'::jsonb),
         'source', 'morphmarket_breeder_tags')::text, E'\n' order by listing_id)
  from t;
```
