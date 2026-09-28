# Morph ID test set

`test-split-breeder-tags.jsonl` holds the 220 MorphMarket listings in the
held-out test split (431 photos). Each row is one gecko:

- `image_urls`: every photo of that listing
- `expected_primary_morph`: the pattern our import picks from the breeder's tags
- `accepted_morphs`: every pattern the breeder tagged

The breeders labeled these animals themselves when listing them for sale.
Since 28 Sep 2026 the retrieval step (`morph_visual_neighbors`) skips the test
split, so Morph ID cannot look up the same gecko while being graded.

## Run it

From GitHub: Actions > morph-id-eval > Run workflow. Leave "limit" blank to
grade all 220 geckos (about $6 and 2 hours one at a time), or set it to 20 for a
quick check. Results appear on the run page, the full report is attached to
the run, and the headline numbers are saved in `geck_data.morph_eval_runs`.
The workflow signs in as a dedicated evaluation account
(`morph-eval@geckinspect.com`) that Morph ID lets run without credits; that
account has no other special access. See `run-ci.mjs`.

From a terminal, with your own signed-in token:

```
pnpm eval:morph-id scripts/morph-id-eval/test-split-breeder-tags.jsonl > morph-id-report.json
```

Needs `MORPH_ID_ACCESS_TOKEN`, `SUPABASE_ANON_KEY` and `SUPABASE_URL` (see the
script's usage text). The report has two kinds of accuracy:

- `overall_top1_accuracy`: first answer equals the single picked pattern
- `overall_top1_breeder_tag`: first answer is any pattern the breeder tagged

The second is the fair headline number. 74 of the 220 geckos carry more than
one morph tag (most often Dalmatian plus Super Dalmatian, or Harlequin plus
Tricolor), and naming either one agrees with the breeder.

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
