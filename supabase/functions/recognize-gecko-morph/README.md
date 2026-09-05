# recognize-gecko-morph edge function

Evidence-first crested gecko visual Morph ID. Takes `{ imageUrl }` or up to
five `{ imageUrls }`, returns the analysis shape `/recognition` and `/training` consume, with every field
clamped to the canonical taxonomy (see `taxonomy.ts`, mirrored from
`src/components/morph-id/morphTaxonomy.js`).

Powered by **Anthropic Claude vision** plus query-specific visual retrieval.
The function embeds one user photo by default (or up to two when configured),
averages normalized vectors when more than one is used,
retrieves source-de-duplicated corpus neighbors, and sends a compact evidence
packet to Claude. Seller labels are explicitly treated as weak positives, not
ground truth.

The structured result includes orthogonal `visual_profile` axes for pattern
coverage, pinning, banding, spotting, and white/cream placement. This avoids
forcing compatible traits into one mutually exclusive label.

This is an identification aid, not a genetic test. It can abstain when photos
are unusable, and it never treats model scores as calibrated probabilities.

## Prerequisites

- Supabase CLI installed and linked to the project
- Anthropic and Replicate API keys
- `20260905031350_morph_retrieval_evidence.sql` applied

## Secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
supabase secrets set REPLICATE_API_TOKEN=r8_xxx
# optional: override the model (default is claude-sonnet-4-6):
supabase secrets set CLAUDE_MODEL=claude-opus-4-7
```

## Retrieval and the static few-shot bank

The static few-shot bank remains disabled by default because broad, imbalanced
examples regressed the internal benchmark. Query-specific retrieval replaces
that behavior: at most six visual neighbors are selected for the submitted
animal, capped per morph and de-duplicated by listing/source cluster.

Retrieval fails open. If Replicate or the corpus index is unavailable, Claude
still analyzes the user photos. When strong retrieval conflicts with the model,
the final assessment is downgraded to tentative rather than presenting a strong
match.

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
    "visual_profile": {
      "pattern_family": "extreme_harlequin",
      "pinning": "partial",
      "banding": "none",
      "spotting": "dalmatian",
      "white_cream_traits": ["white_fringe", "portholes"]
    },
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
    "visual_evidence": {
      "status": "available",
      "model": "krthr/clip-embeddings",
      "photo_count": 2,
      "consensus": {
        "primary_morph": "extreme_harlequin",
        "agreement": 0.63,
        "support": 2,
        "source_diversity": 2
      },
      "neighbors": []
    },
    "explanation": "The visible leg and flank coverage support extreme harlequin. A top-down view would make the distinction stronger.",
    "taxonomy_version": "2026.09.05",
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
