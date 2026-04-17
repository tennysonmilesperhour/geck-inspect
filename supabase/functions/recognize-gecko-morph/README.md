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
```

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
