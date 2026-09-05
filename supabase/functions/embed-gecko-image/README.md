# embed-gecko-image

Computes a 768-dimension unit-normalized visual embedding and optionally
persists it to `gecko_images.image_embedding`.

Used for:

- **/recognition evidence**: one user photo is embedded by default and sent to
  the service-only `morph_visual_neighbors()` RPC. The configurable two-photo
  mode averages normalized vectors when provider rate limits allow it.
- **Backfill**: run against every verified row once after the pgvector
  migration. Can be invoked from a one-off script / Supabase cron.

## Secrets

```bash
supabase secrets set REPLICATE_API_TOKEN=r8_xxx
supabase secrets set MORPH_EMBED_BACKFILL_KEY=<high-entropy-random-value>
# Replace with a real SigLIP2 endpoint on Replicate (whichever is live):
supabase secrets set SIGLIP_MODEL=<owner/model-name>
```

The default `krthr/clip-embeddings` model preserves the existing 768-dimension
index. Benchmark a SigLIP2 or DINO-family endpoint before changing the model,
then backfill the entire corpus with one model version; never mix embeddings
from different encoders in the same index.

## Deploy

```bash
supabase functions deploy embed-gecko-image
```

## Call

```bash
# Just get the embedding (authenticated user):
curl -X POST "$SUPABASE_URL/functions/v1/embed-gecko-image" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"imageUrl":"https://..."}'

# Embed and persist onto an existing gecko_images row:
curl -X POST "$SUPABASE_URL/functions/v1/embed-gecko-image" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "x-morph-embed-key: $MORPH_EMBED_BACKFILL_KEY" \
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

Once the pgvector column exists, fill it with the resumable queue script.
The separate backfill key authorizes persistence specifically for this
server-side job; browser callers still require an admin or expert role.

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
MORPH_EMBED_BACKFILL_KEY=<backfill-key> \
pnpm backfill:morph-embeddings -- --limit 500 --concurrency 1
```
