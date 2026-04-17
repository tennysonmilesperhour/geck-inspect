# embed-gecko-image

Computes a visual embedding for a gecko image (SigLIP2-base / 768-dim unit
vector by default) and optionally persists it to `gecko_images.image_embedding`.

Used for:

- **/recognition second signal** — at analyze time, embed the query and
  call `nearest_training_samples()` to surface the closest verified samples.
- **Backfill** — run against every verified row once after the pgvector
  migration. Can be invoked from a one-off script / Supabase cron.

## Secrets

```bash
supabase secrets set REPLICATE_API_TOKEN=r8_xxx
# Replace with a real SigLIP2 endpoint on Replicate (whichever is live):
supabase secrets set SIGLIP_MODEL=<owner/model-name>
```

> The default `krthr/clip-embeddings` placeholder above is just a shape
> example — plug in the SigLIP2 deployment you want to use (or
> `nateraw/siglip` or similar) and verify the output dimension matches
> the `vector(768)` column. Adjust the migration and HNSW index if you
> pick a different size.

## Deploy

```bash
supabase functions deploy embed-gecko-image
```

## Call

```bash
# Just get the embedding (useful for real-time query embedding):
curl -X POST "$SUPABASE_URL/functions/v1/embed-gecko-image" \
  -H 'Content-Type: application/json' \
  -d '{"imageUrl":"https://..."}'

# Embed and persist onto an existing gecko_images row:
curl -X POST "$SUPABASE_URL/functions/v1/embed-gecko-image" \
  -H 'Content-Type: application/json' \
  -d '{"imageUrl":"https://...","geckoImageId":"<uuid>"}'
```

Response shape:

```json
{
  "embedding": [0.0123, -0.0456, ...],
  "model": "nateraw/siglip",
  "persisted": true
}
```

## Backfill

Once the pgvector column exists, fill it for every row that doesn't
have an embedding yet:

```bash
supabase sql "SELECT id, image_url FROM gecko_images WHERE image_embedding IS NULL LIMIT 5000" \
  | jq -rc '.[] | {imageUrl: .image_url, geckoImageId: .id}' \
  | while read body; do
      curl -s -X POST "$SUPABASE_URL/functions/v1/embed-gecko-image" \
           -H "Content-Type: application/json" -d "$body" > /dev/null
    done
```
