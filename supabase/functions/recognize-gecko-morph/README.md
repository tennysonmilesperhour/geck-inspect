# recognize-gecko-morph edge function

Structured crested-gecko morph ID. Takes `{ imageUrl }`, returns the morph
analysis shape `/recognition` and `/training` consume, with every field
clamped to the canonical taxonomy (see `taxonomy.ts`, mirrored from
`src/components/morph-id/morphTaxonomy.js`).

Powered by **Anthropic Claude vision** with tool-use for guaranteed
structured JSON output. The tool's `input_schema` encodes the taxonomy
enums, so the model can't return an id that isn't in our ontology.

## Prerequisites

- Supabase CLI installed and linked to the project
- An Anthropic API key

## Secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
# optional — override the model (default is claude-sonnet-4-6):
supabase secrets set CLAUDE_MODEL=claude-opus-4-7
# optional — how many verified examples per primary_morph to inject as
# few-shot anchors (default 2, max 4, 0 disables few-shot entirely):
supabase secrets set FEW_SHOT_PER_MORPH=2
```

## Few-shot bank

On cold start, the function reads up to `FEW_SHOT_PER_MORPH` verified
rows per `primary_morph` from `gecko_images` (most recent first) and
prepends them to the Claude prompt as labeled image blocks. This gives
the model explicit visual anchors for each label instead of relying on
prior knowledge alone — particularly important for the harlequin vs
extreme_harlequin and dalmatian vs red_dalmatian distinctions.

The bank is cached in module memory for the life of the warm instance.
A redeploy or cold start refreshes it, so the more rows experts verify,
the better-anchored the tool gets — measured by
`scripts/eval_morph_id.py` against geck-data's test split.

## Deploy

```bash
supabase functions deploy recognize-gecko-morph --no-verify-jwt
```

## Response shape

```json
{
  "success": true,
  "model": "claude-sonnet-4-6",
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
    "model": "claude-sonnet-4-6"
  }
}
```

Error shape:

```json
{ "error": "Anthropic 429: rate limit exceeded" }
```

## Upgrading the taxonomy

Any change to `src/components/morph-id/morphTaxonomy.js` that adds or
renames ids must be mirrored into `taxonomy.ts` here, and
`TAXONOMY_VERSION` bumped in both places in the same commit. The tool
schema is built from those arrays at runtime, so Claude's output
automatically picks up the new ids once the function is redeployed.
