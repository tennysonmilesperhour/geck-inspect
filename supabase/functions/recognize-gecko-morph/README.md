# recognize-gecko-morph edge function

Evidence-first crested gecko visual Morph ID. Takes `{ imageUrl }` or up to
five `{ imageUrls }`, returns the analysis shape `/recognition` and `/training` consume, with every field
clamped to the canonical taxonomy (see `taxonomy.ts`, mirrored from
`src/components/morph-id/morphTaxonomy.js`).

Powered by **Anthropic Claude vision** with tool-use for guaranteed
structured JSON output. The tool's `input_schema` encodes the taxonomy
enums, so the model can't return an id that isn't in our ontology.

This is an identification aid, not a genetic test. It can abstain when photos
are unusable, and it never treats model scores as calibrated probabilities.

## Prerequisites

- Supabase CLI installed and linked to the project
- An Anthropic API key

## Secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
# optional: override the model (default is claude-sonnet-4-6):
supabase secrets set CLAUDE_MODEL=claude-opus-4-7
```

## Few-shot bank (reverted, see PR #56)

An earlier version (#55) loaded verified rows from `gecko_images` at
cold start and prepended them to the prompt as labeled image blocks.
That version was reverted because stacking multiple base44-prefixed
PNG screenshots with the user photo caused Anthropic's image-prefetch
to 500 on ~84% of calls. Re-introducing requires curating the bank to
small, well-formed JPEGs first.

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
    "assessment_status": "best_match",
    "primary_morph": "extreme_harlequin",
    "candidate_morphs": [
      {
        "morph": "extreme_harlequin",
        "score": 82,
        "why": "Heavy cream pattern continues across the legs and flanks."
      },
      {
        "morph": "harlequin",
        "score": 64,
        "why": "A plausible lower-coverage alternative."
      }
    ],
    "genetic_traits": ["lily_white"],
    "secondary_traits": ["white_fringe", "portholes"],
    "base_color": "dark_red",
    "pattern_intensity": "high",
    "white_amount": "high",
    "fired_state": "fired_up",
    "confidence_score": 82,
    "model_signal": 82,
    "evidence_markers": ["Heavy leg coverage", "Cream pattern across both flanks"],
    "uncertainty_reasons": ["Tail base is partly hidden"],
    "photo_assessment": {
      "subject_is_crested_gecko": true,
      "usable_for_id": true,
      "quality_grade": "good",
      "issues": [],
      "next_photo_needed": "Add a top-down photo to check dorsal coverage."
    },
    "explanation": "The visible leg and flank coverage support extreme harlequin. A top-down view would make the distinction stronger.",
    "taxonomy_version": "2026.09.04",
    "model": "claude-sonnet-4-6"
  }
}
```

Error shape:

```json
{ "error": "The recognition service is temporarily busy.", "code": "upstream_rate_limited" }
```

The function requires a valid user access token. It reserves a monthly credit
before calling the model and refunds that credit if the analysis fails.

## Upgrading the taxonomy

Any change to `src/components/morph-id/morphTaxonomy.js` that adds or
renames ids must be mirrored into `taxonomy.ts` here, and
`TAXONOMY_VERSION` bumped in both places in the same commit. The tool
schema is built from those arrays at runtime, so Claude's output
automatically picks up the new ids once the function is redeployed.
