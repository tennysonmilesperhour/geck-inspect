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
- `20261017170000_morph_reference_vectors.sql` applied for the faster
  reference-photo query (the function works the same without it)

## Secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
supabase secrets set REPLICATE_API_TOKEN=r8_xxx
# optional: override the model (default is claude-sonnet-4-6):
supabase secrets set CLAUDE_MODEL=claude-opus-4-7
# optional: the photo the warm-up embeds (default is a demo photo in public/):
supabase secrets set MORPH_WARM_IMAGE_URL=https://geckinspect.com/demo-geckos/blush.webp
```

## Retrieval and the static few-shot bank

The static few-shot bank remains disabled by default because broad, imbalanced
examples regressed the internal benchmark. Query-specific retrieval replaces
that behavior: at most six visual neighbors are selected for the submitted
animal, capped per morph and de-duplicated by listing/source cluster.

Retrieval fails open. If Replicate or the corpus index is unavailable, Claude
still analyzes the user photos. When strong retrieval conflicts with the model,
the final assessment is downgraded to tentative rather than presenting a strong
match. The one exception is a Replicate model that is still booting at the
embedding deadline (69.5 seconds after the request arrived for one or two
photos, 59 for five): see "Time limits" below.

Since 17 October 2026 the reference photos are read from
`public.morph_reference_vectors` (migration
`20261017170000_morph_reference_vectors.sql`), a copy of the eligible
`gecko_images` rows with the labels worked out once and the embedding stored in
the row. A trigger keeps it in step. `morph_visual_neighbors` kept its name,
arguments and results: `supabase/tests/morph_neighbors_regressions.sql` shows
it returns what the old query returns when that query compares every row.
Whether production's old function did compare every row (rather than use the
approximate `idx_gecko_images_embedding` index) cannot be read from EXPLAIN,
because a function with a SET clause is never inlined and its plan shows one
Function Scan. `supabase/tests/morph_neighbors_production_check.sql` checks it
on production by comparing the function's answers with the exact ones; it is
run before the migration is merged (deploy queue, 17 October).

## How a request runs, and where the time goes

The Claude call is about 88 percent of a normal request (27 to 41 seconds,
mostly the length of the answer). The rest is kept short by running
independent steps together (`../_shared/morph-steps.ts`):

1. The sign-in check and reading the body run together.
2. The profile, the plan, the per-network cap and today's count are read
   together.
3. The request key is claimed, then the scan is reserved. The key always
   comes before the scan (a repeat of a finished request never spends one)
   and the scan before the Claude call.
4. Then the photo lookup starts (Replicate embeds the top view, then
   `morph_visual_neighbors` finds the reference photos), alongside the
   scans-left read, which is only awaited when the answer is built. Admin and
   evaluation calls take no scan, so for them it starts after step 2.
5. The photo lookup is awaited just before the Claude call.
6. After the answer: the refund (for a "better photos needed" answer) and the
   request-key settle are awaited, because the answer reports the refund and a
   retry replays the stored answer. The spend log row is written after the
   answer goes out (`EdgeRuntime.waitUntil`).

The photo lookup waits for the scan on purpose. Replicate runs a prediction
once it has accepted it, whether or not the function keeps waiting, and the
photo address comes from the caller. So an early exit (sign-in failure,
per-network limit, a repeat, a run still going, no scans left, a failed
credit check) never reaches Replicate: a double tap cannot take the first
request's place under Replicate's one-at-a-time limit, and an account with
no scans left cannot have Replicate fetch photos in a loop.

Every answer carries a `Server-Timing` header (exposed to the browser), and
the function logs one JSON line per request (`event: "morph_id_timing"`) with
the outcome, the photo count and the step times. Neither holds a photo URL or
anything about the member (`../_shared/morph-timing.ts`). The steps:

| Step | What it times |
|---|---|
| `auth` | the sign-in check |
| `db` | profile and plan, the per-network reads, the request key, the scan |
| `embed` | the Replicate embedding (a cold model shows here, 35 to 75 s) |
| `neighbors` | the reference-photo query |
| `wait` | time spent waiting for the photo lookup after the `db` steps |
| `claude` | the Claude call, retries included |
| `writes` | refund, scans-left read and request-key settle |
| `total` | arrival to answer |

Steps that overlap are reported as they ran, so they can add up to more than
`total`. The daily canary prints the `embed` and `claude` split next to its
100 second check and labels an embedding over 30 seconds a "Replicate cold
start" (`scripts/canary/serverTiming.mjs`).

## Time limits

All counted from the moment the request arrives (`../_shared/morph-budget.ts`):

- The whole request: 105 seconds, 15 under the browser's 120 second limit
  (`src/lib/supabaseClient.js`) and 20 under the canary's 125.
- Claude: at most 90 seconds and never past 105 seconds. A call is started
  only with enough time left for the photos it reads: 32 seconds for one or
  two photos and 3.5 more for each photo past two, so 42.5 for five
  (five-photo answers have taken up to 41 seconds). The 32 is an estimate
  just above the median answer (about 30 seconds); the times have not been
  split by photo count yet, and the `morph_id_timing` log line (`photos`,
  `claude`) is where to check it.
- The embedding: until the point that still leaves the reference-photo query
  3 seconds, half a second to start the call and Claude its minimum, so 69.5
  seconds from arrival for one or two photos and 59 for five. One timer
  covers the prediction request, one throttled retry and every poll, and
  `Prefer: wait` asks Replicate to hold the request for the seconds left. The
  reference-photo query then has 3 seconds. The limits come from the same
  numbers, so a request that gets past the reference query (even one cut off
  at its deadline, which then goes ahead without references) always has
  Claude's minimum left.

If the embedding model is still booting at its deadline, or less than Claude's
minimum is left when Claude would start, the function answers with the usual
`upstream_timeout` failure (same code, same member text, scan handed back)
without calling Claude, at 59 to 70 seconds instead of 100 to 130. The
Replicate boot carries on, so a retry finds the model warm. An embedding that
fails outright (a bad photo, a refused request) still answers without
reference photos, as before. A throttled embedding (Replicate allows one
request at a time while the account has under $5 of credit) waits once for
Replicate's `Retry-After` when that still fits before the deadline, so the
reference photos stay in the prompt.

**Keep Replicate credit at $5 or more.** That lifts the one-request-at-a-time
limit, so warm-ups and identifications never throttle each other.

## Warm-up

`krthr/clip-embeddings` is a public community model, so Replicate shuts it down
when nobody has used it for a while, and the next request waits 35 to 75
seconds for it to boot. Every Morph ID run of 100 seconds or more in October
2026 was that boot.

So the Morph ID page sends `{ "action": "warm" }` when a signed-in member with
a scan left opens it, and again when the member picks the top view if 3 minutes
have passed (`src/lib/morphIdWarmup.js`). The function checks the sign-in
(`auth.getUser` only), skips if any warm-up went out in the last 60 seconds
(the newest `geck_data.model_invocations` row with surface `morph_id_warm`),
and otherwise posts one Replicate prediction at the pinned version for a photo
the project owns (`https://geckinspect.com/demo-geckos/blush.webp`, or the
`MORPH_WARM_IMAGE_URL` secret). It sends no `Prefer` header, so Replicate
answers as soon as the prediction is queued. It answers 202 with
`{ "warmed": true }` or `{ "warmed": false, "reason": "recent" }`.

A warm-up never reads photo URLs from the body, never takes a scan or a
request key, and is not counted by the per-network cap (that counts only
`morph_id_production` rows). It logs a zero-cost row with surface
`morph_id_warm`, which shows up as its own line in `v_model_spend_7d`. No
member photo leaves the browser, so it needs no AI consent prompt; that still
comes at Identify. The daily canary sends the same warm-up when it starts.

## The request the model reads

The instructions, the tool schema and the order of the content blocks are
built in `request.ts`. `src/lib/__tests__/morphRequestSnapshot.test.js`
compares that request byte for byte with the one the function sent before the
October 2026 speed work (`src/lib/__tests__/__fixtures__/morphRequestSnapshot.json`).
Only `max_tokens` may differ: the model never sees it. It is 4096 on Sonnet 4.6
(the largest answer since it was 3000 was 2,087 tokens) and 12000 on the newer
models, and an answer cut off at the ceiling is retried once with twice the
room (`retryShape` in `../_shared/morph-upstream.ts`). Changing anything else
in `request.ts` changes what the model reads before it answers, so it needs a
graded run first (`docs/morph-id-eval/README.md`).

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
    "pattern_color": "cream_white",
    "fired_state": "fired_up",
    "confidence_score": 82,
    "model_signal": 82,
    "photo_observations": [
      {
        "photo_number": 1,
        "view": "left_side",
        "quality_grade": "good",
        "contributes_to_result": true,
        "evidence_signal": 88,
        "visible_features": ["Heavy cream pattern across the flank and legs"],
        "limitations": []
      }
    ],
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
    "taxonomy_version": "2026.09.06",
    "model": "claude-sonnet-4-6"
  }
}
```

Error shape:

```json
{ "error": "The recognition service is temporarily busy.", "code": "upstream_rate_limited" }
```

The function requires a valid user access token. It reserves a monthly credit
before calling the model and refunds that credit if the analysis fails,
including when it is not started because time ran out (`upstream_timeout`,
see "Time limits").

## Upgrading the taxonomy

Any change to `src/components/morph-id/morphTaxonomy.js` that adds or
renames ids must be mirrored into `taxonomy.ts` here, and
`TAXONOMY_VERSION` bumped in both places in the same commit. The tool
schema is built from those arrays at runtime, so Claude's output
automatically picks up the new ids once the function is redeployed.
