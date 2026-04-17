# recognize-gecko-morph edge function

Structured crested-gecko morph ID. Takes `{ imageUrl }`, returns the morph
analysis shape `/recognition` and `/training` consume, with every field
clamped to the canonical taxonomy (see `taxonomy.ts`, mirrored from
`src/components/morph-id/morphTaxonomy.js`).

Defaults to **Qwen2.5-VL-7B-Instruct** on Replicate. Swap the model by
setting `REPLICATE_MODEL`, which makes it easy to plug in a fine-tuned
checkpoint later.

## Prerequisites

- Supabase CLI installed and linked to the project
- A Replicate account with a funded API token

## Secrets

```bash
supabase secrets set REPLICATE_API_TOKEN=r8_xxx
# optional — override the model (owner/name format):
supabase secrets set REPLICATE_MODEL=lucataco/qwen2-vl-7b-instruct
```

## Deploy

```bash
supabase functions deploy recognize-gecko-morph --no-verify-jwt
```

`--no-verify-jwt` lets anon/unauthenticated calls reach it. If you want
to gate the endpoint behind Supabase auth, drop the flag and pass the
user's JWT in the `Authorization` header from the client (the existing
`supabase.functions.invoke` call already does this).

## Response shape

```json
{
  "success": true,
  "model": "lucataco/qwen2-vl-7b-instruct",
  "analysis": {
    "primary_morph": "extreme_harlequin",
    "genetic_traits": ["lily_white"],
    "secondary_traits": ["white_fringe", "portholes"],
    "base_color": "dark_red",
    "pattern_intensity": "high",
    "white_amount": "high",
    "fired_state": "fired_up",
    "confidence_score": 82,
    "explanation": "Heavy red pattern extending onto legs with prominent white belly...",
    "taxonomy_version": "2026.04.17",
    "model": "lucataco/qwen2-vl-7b-instruct"
  }
}
```

Error shape:

```json
{ "error": "Replicate 402: billing limit exceeded" }
```

## Local test

```bash
supabase functions serve recognize-gecko-morph --env-file .env.local
curl -X POST http://localhost:54321/functions/v1/recognize-gecko-morph \
  -H 'Content-Type: application/json' \
  -d '{"imageUrl":"https://..."}'
```

## Upgrading the taxonomy

Any change to `src/components/morph-id/morphTaxonomy.js` that adds or
renames ids must be mirrored into `taxonomy.ts` here, and
`TAXONOMY_VERSION` bumped in both places in the same commit. The
function will happily accept unknown ids from the model at runtime —
they'll just be filtered out by `clampToTaxonomy`, so you'll silently
lose signal until the mirror is updated.
