# Morph ID evaluation: how it works, why the number is not yet trustworthy, and the plan

This folder is where Morph ID's accuracy is written down. It exists because
two reviews in October 2026 (the comprehensive review, section B8 and plan
item E3 29, and the adversarial review, section 10) found that the accuracy
figure behind the flagship paid feature does not measure what a member will
get. This page says how evaluation works today, what is wrong with it, and
the plan for a set of photos that can give an honest number. Each graded run
from now on gets one line in the run log at the bottom.

Plain-language terms used below:

- **Top-1**: Morph ID's first answer matches the label. **Top-3**: the label
  is somewhere in its first three answers.
- **Test set**: photos kept aside and used only to grade. **Validation set**:
  photos used while trying changes, so the test set stays untouched.
- **Reference photos**: the labelled photos Morph ID looks up for the
  closest match (the "photo lookup") before the model answers.
- **Seller leakage**: when photos from the same seller sit in both the test
  set and the reference photos, so a match can come from the seller's own
  background, lighting and naming habits instead of the gecko.

## How evaluation works today

| Piece | Where |
|---|---|
| Test set | `scripts/morph-id-eval/test-split-breeder-tags.jsonl`: 220 marketplace listings (431 photos), one row per gecko, labelled with the tags the seller gave it |
| Grader | `scripts/eval-morph-id.mjs`: calls the live `recognize-gecko-morph` function for each row and scores top-1 and top-3 |
| Runner | `.github/workflows/morph-id-eval.yml` (Actions, run by hand) through `scripts/morph-id-eval/run-ci.mjs`, signed in as the evaluation account |
| Results | headline numbers in `geck_data.morph_eval_runs`; the full report is a GitHub artifact kept 90 days; per-call tokens and cost in `geck_data.model_invocations` (surface `morph_id_eval`) |
| Cost | about $6 and 2 hours for all 220 at one call at a time; a 20-gecko smoke run is about 60 cents |

Two accuracy lines come out of each run:

- `top1_single`: the first answer equals the one pattern our import picked
  from the seller's tags.
- `breeder_tag_top1`: the first answer is any pattern the seller tagged.
  74 of the 220 geckos carry more than one pattern tag (for example
  Harlequin and Tricolor), so this is the fairer of the two and the one
  quoted below.

The photo lookup skips the test split since 28 September 2026, so Morph ID
cannot find the exact gecko it is being graded on. It can still find other
geckos from the same seller (see below).

## What the runs say so far

| Run | Date | Model, function version | Graded | Top-1 (seller tag) | Top-3 (seller tag) | Answered |
|---|---|---|---|---|---|---|
| 17 | 28 Sep | Sonnet 4.6, v59 | 220 | 43.6% | 68.6% | 68% |
| 19 | 28 Sep | Sonnet 4.6, v60 | 195 (cut off by credit) | 37.4% | 72.8% | 98% |
| 20 | 28 Sep | Sonnet 4.6, v61 (shipped) | 220 | 43.6% | 75.9% | 95% |
| 21 | 6 Oct | Sonnet 5.5, v67 smoke | 20 | 45% | 65% | 100% |
| 22 | 6 Oct | Opus 5.5, v67 smoke | 20 | 55% | 60% | 100% |
| 23 | 6 Oct | Opus 5.5, v67 full (cut off by credit at 32) | 32 | 34.4% | 65.6% | 94% |

Read from `geck_data.morph_eval_runs` on 16 October 2026. The 95 percent
confidence range on the shipped 43.6% is roughly 37% to 50%. The 20-gecko
smoke runs are far too small to compare models: one gecko is 5 points. The
full Sonnet 5.5 and Opus 5.5 runs on 6 October stopped when the Anthropic
credit ran out, which also broke production Morph ID calls that week.

## The speed work of 17 October 2026 and grading

Morph ID was made faster without touching what decides the answer, so runs
before and after it compare like for like:

- **The request the model reads is unchanged.** The instructions, tool schema
  and content blocks now live in `supabase/functions/recognize-gecko-morph/request.ts`,
  and `src/lib/__tests__/morphRequestSnapshot.test.js` checks them byte for
  byte against the request sent before the change. Same model, same photo
  embedded, same pinned Replicate version, same reference photos (the reference
  query is unchanged: a faster exact version was held back because production's
  current query is approximate, so an exact one would change the photos).
- **Only the answer's ceiling moved.** `max_tokens` went from 3000 to 4096 on
  Sonnet 4.6. The model never sees it; it only stops an unusually long answer
  from being cut off. A cut-off answer is retried once with twice the room.
- **A cold photo-matching model fails faster.** If Replicate is still booting
  the embedding model 69.5 seconds into a one- or two-photo call (59 seconds
  into a five-photo call), the call ends there with `upstream_timeout`
  instead of running Claude with too little time left. The grader retries a
  502 once after 5 seconds (`scripts/eval-morph-id.mjs`), and the boot
  carries on meanwhile, so the retry normally finds the model warm. Before, the same call failed at 100 to
  130 seconds and was retried the same way.
- **A throttled embedding waits instead of dropping the references.** Under
  Replicate's one-request-at-a-time limit (less than $5 of credit), a
  throttled embedding used to be skipped, which took the reference photos out
  of that call's prompt. It now waits once for Replicate's `Retry-After` when
  that fits in the time limit. A run graded one call at a time rarely meets
  this; if a run's references were missing on some rows before, a rerun can
  differ there.
- **Each call says where its time went.** The function's `Server-Timing`
  header splits a call into sign-in, database, embedding, reference query,
  Claude and writes; the function log has the same line per call
  (`event: "morph_id_timing"`).

## Why this number is not a valid accuracy figure yet

1. **Seller leakage.** The split was made by listing, not by seller. Checked
   on 16 October 2026: 124 of the 134 sellers in the test set also have
   listings in the reference photos, and 207 of the 220 test geckos come
   from one of those sellers. The reference pool is every labelled photo
   except the test split, so the validation split (205 listings) is in the
   pool too. The adversarial review measured what that does: for 62% of
   test photos the single closest reference photo is from the same seller;
   its label matches 53.7% of the time when it is the same seller and 26.2%
   when it is not; with same-seller photos taken out, the lookup's agreement
   falls to 28.2%, below always answering "Harlequin". A member's own phone
   photo never shares a seller with the reference photos.
2. **Plain baselines are close.** Always answering Harlequin scores 31.8%
   top-1. A fixed shortlist of Harlequin, Tricolor and Dalmatian, with no
   photo at all, scores 65.5% top-3. The photo lookup alone scores 43.2%
   top-1 and 73.6% top-3, about what the model scores. The model call adds
   little over the free lookup on this set.
3. **The test set was used for tuning.** The version 61 ordering rule was
   found on run 19 of this test set and confirmed by rerunning the same 220
   geckos; a relabel changed 20 expected answers after the errors had been
   seen. The validation split was never used.
4. **The labels are seller claims.** Sellers have reasons to upgrade a name
   ("Extreme", "Pinstripe"), and 74 rows carry more than one pattern tag.
   Nobody independent has checked them.
5. **The photos are not member photos.** Test photos are 550-pixel
   marketplace thumbnails. Members upload phone photos, about four times the
   tokens, 3.3 photos per identification on average, and age and fired
   state are unknown for every test row.
6. **Gaps in what is graded.** 11 of the 23 pattern classes appear in the
   test set; Tiger is 0 for 5. The traits that drive price and the lethal
   pairing warnings (Lilly White, Cappuccino, Axanthic, White Wall) are
   never scored, although the test set holds 27 Lilly White and 12
   Cappuccino photos. There is no "not a crested gecko" set.
7. **The confidence score is the model rating itself.** Only 1 of 220
   answers in the shipped run reached "best match". Since 16 October 2026
   the app shows the score as words ("AI's own estimate: close fit") rather
   than "82/100" (`src/components/morph-id/modelSignal.js`). Bands fitted on
   real data replace those words once the gold set below exists.

## The plan: a seller-disjoint gold set

The goal is one published accuracy number that a breeder can trust, with
the split by seller, the plain baselines beside it, and labels nobody can
call self-serving.

### Step 1: re-split what we have (a session can do this, no spend)

- Split the existing labelled listings by **seller**, not by listing:
  every seller's geckos go into exactly one of train, validation or test.
  Remove near-duplicate photos across splits (photo fingerprints closer
  than a set distance).
- When grading, the photo lookup must **exclude the query's seller**. This
  needs a new optional argument on `morph_visual_neighbors` (a migration)
  and a field in the manifest; production calls are unchanged.
- Report the three baselines in every run next to the model: the most
  common class, the fixed shortlist, and the lookup alone.
- Report per-class precision and recall with confidence ranges, and
  compare versions with a paired test (McNemar) over three repeats, not a
  single headline.
- Work on the validation split only. Touch the test split once per
  release, with the metric written down before the run.
- Keep the manifest free of seller names and marketplace URLs once the
  photos are copied to our own storage under a licence (see the corpus
  finding in the adversarial review; that is a separate decision).

**Done on 31 October 2026 (no spend):**

- **The split.** `scripts/morph-id-eval/seller-split-v1.csv` puts every one
  of the 1,879 listings that have a stored photo fingerprint into one split
  by seller: 417 sellers, none in two splits. Train 1,391 listings (312
  sellers), validation 219 (48 sellers), test 269 (57 sellers). A seller's
  split comes from a fixed hash of the seller's name (`md5('seller-split-v1:'
  || lower(trim(seller name)))`, under 0.15 test, under 0.30 validation), so
  the same rule gives the same split again. The files carry anonymous seller
  group numbers (`s001` and so on) instead of names, and the photo links
  point at our own `listing-images` copies, not the marketplace. The
  database's own `geck_data_split` is not changed, so production's lookup
  still skips the old test split.
- **Grader manifests.** `seller-split-v1-val.jsonl` and
  `seller-split-v1-test.jsonl` are in the format `scripts/eval-morph-id.mjs`
  reads, with one extra field, `exclude_seller_of_listing`.
- **Near-duplicates.** No photo in validation or test has a photo in
  another split closer than 0.02 (cosine distance between photo
  fingerprints), so none were removed. A smaller threshold is not useful
  here: the median distance from a photo to the closest photo of a
  *different* listing is about 0.05, so the fingerprint cannot tell "the same
  photo" from "a similar gecko" above about 0.02.
- **The lookup that leaves out the seller.** A new database function,
  `morph_visual_neighbors_excluding_seller(query_embedding, match_count,
  exclude_seller_of_listing)` (migration `20261031005507`), returns what
  `morph_visual_neighbors` returns minus every photo from that listing's
  seller (matched by seller name or slug). It is a new function, not a
  third argument on the old one, because a second version of
  `morph_visual_neighbors` would make the live call from
  `recognize-gecko-morph` ambiguous. With no listing it returns the same
  photos as the old function (checked on 20 production samples on
  31 October: 0 differ). Production calls are unchanged.
- **Still to do for this step.** The grader cannot use the new function
  yet: `recognize-gecko-morph` always calls `morph_visual_neighbors`. The
  next change is an evaluation-only option in that function (honoured only
  for the evaluation account) that passes `exclude_seller_of_listing` from
  the manifest through to the new function. Per-class precision and recall
  and the McNemar comparison come with the first model run on the new
  split.

### Step 2: the gold set (Tennyson recruits the labellers)

- **Size.** Start with 50 animals for the classes sellers mislabel most
  (Harlequin, Extreme Harlequin, Pinstripe, Tricolor, Tiger, Dalmatian), as
  plan item E3 29 says, then grow toward 400 animals with at least 30 per
  class the app names, stratified by age and fired state.
- **Sources.** About 100 real member phone submissions, used only with the
  member's opt-in, plus licensed photos from partner breeders. No scraped
  photos.
- **Labellers.** Three experienced crested gecko breeders label each
  animal **blind**: they never see the seller's tag or Morph ID's answer.
  "Can't tell from these photos" is an allowed answer.
- **Agreement.** Report how much the three agree (Fleiss' kappa). An animal
  with no majority goes into an "ambiguous" class, where the right answer
  for Morph ID is to say the photos are not enough.
- **Genes, separately.** A yes or no set for Lilly White, Cappuccino,
  visual Axanthic and White Wall, with the Lilly White miss rate called out
  on its own, because a missed Lilly White is how a lethal pairing goes
  unwarned.
- **Label sheet.** One JSONL row per animal: `id`, `image_urls` (our
  storage), `age_stage`, `fired_state`, `source` (`member_optin` or
  `partner_breeder`), `labels` (one entry per labeller: pattern, genes, or
  `cannot_tell`), `majority`, and `split` (`gold_test` or `gold_dev`).

### Step 3: then grade and decide

- A 20-animal smoke set from the gold dev split, run on every change to
  `recognize-gecko-morph` (plan item E3 29).
- Grade Claude Sonnet 4.6 (today's model), Claude Sonnet 5.5 and Claude
  Opus 5.5 on the gold test split, three repeats each, and switch only if
  the difference beats the noise. On the 220-listing set this costs about
  $12 for the two newer models; on the gold set it depends on its size.
  Morph ID stays on Sonnet 4.6 until then. This spend is Tennyson's call.
- Run evaluation on a **separate Anthropic workspace and key** with a
  monthly spend limit, so an evaluation can never use up the credit that
  production Morph ID needs (that happened on 6 October). Tennyson sets
  this up in the Anthropic console.

## Run log

Add one line per graded run: date, model and function version, split and
size, top-1 and top-3 against the label, the three baselines, answered
share, and the run id in `geck_data.morph_eval_runs`. Runs before the
seller-disjoint split are in the table above and are not comparable with
runs after it.

| Date | Model, version | Split, size | Top-1 | Top-3 | Baselines (majority / shortlist / lookup) | Answered | Run id |
|---|---|---|---|---|---|---|---|
| 31 Oct 2026 | No model (baselines only, SQL on stored fingerprints) | Seller split v1, validation, 219 | n/a | n/a | 34.7% / 60.3% / 26.9% top-1, 58.9% top-3 | n/a | none (no model call) |
| 31 Oct 2026 | No model (baselines only, SQL on stored fingerprints) | Seller split v1, test, 269 | n/a | n/a | 33.5% / 71.0% / 24.9% top-1, 63.2% top-3 | n/a | none (no model call) |

### 31 October 2026: the three baselines on the seller split

No model was called and nothing was spent: every number comes from labels
and photo fingerprints already in the database. The score is the seller's
tags (a guess counts when it is any pattern the seller tagged), as in
`breeder_tag_top1` above. The 95 percent ranges assume each gecko is
independent; geckos from one seller are not, so the true ranges are wider.

| Baseline | Validation (219) | Test (269) |
|---|---|---|
| Most common class (always "Harlequin", the most tagged pattern in train) | 34.7% (29 to 41) | 33.5% (28 to 39) |
| Fixed shortlist, top-3 (Harlequin, Tricolor, Extreme Harlequin: the three most tagged in train) | 60.3% (54 to 67) | 71.0% (65 to 76) |
| Photo lookup alone, seller left out, top-1 | 26.9% (21 to 33) | 24.9% (20 to 30) |
| Photo lookup alone, seller left out, top-3 | 58.9% (52 to 65) | 63.2% (57 to 69) |
| For comparison: same lookup with the seller allowed, top-1 / top-3 | 32.4% / 63.5% | 29.7% / 66.5% |

How the lookup was scored: `morph_visual_neighbors_excluding_seller(photo,
48, listing)` exactly as production would run it, top-1 is the pattern of the
closest returned photo and top-3 the first three different patterns in
order. A stricter version (exact closest photo among the train split only)
gives the same picture: validation 26.9% top-1 and 58.9% top-3, test 19.7%
and 58.7%.

What it says:

- **With the seller left out, the free photo lookup is worse than always
  answering Harlequin**, on both splits, and its top-3 is no better than a
  fixed shortlist that never looks at the photo. This matches the
  adversarial review's 28.2%. The 43.2% lookup figure on the old split was
  mostly the lookup recognising the seller.
- **So the model's 43.6% on the old split cannot be read as skill yet.** The
  next model run on this split has to beat 34.7% top-1 and 60.3% top-3 on
  validation to show it adds anything over a constant answer.
- **Allowing the seller back in adds about 5 points** in production's
  lookup, which keeps one photo per seller. The exact single closest photo,
  any seller, scores 42.5% on validation and 38.3% on test, close to the old
  43.2%: that is the leak.

Caveats:

- **The splits are lumpy.** Validation has 48 sellers and the largest has
  25 listings; its class mix differs from train (Extreme Harlequin is the
  most common primary label in train, 23%, but 9% in validation), which is
  why the shortlist scores 60% there and 71% on test. One split is one draw;
  quote both, and do not tune on test.
- **Production's lookup is approximate.** Its index search looks at a
  limited candidate list (pgvector's default search width is 40) before
  keeping one photo per seller, so a call returns 16 to 20
  photos on average (minimum 5), not 48. The baseline above uses it as it
  is, because that is what Morph ID sees.
- **The labels are still seller claims**, the photos are still 550-pixel
  marketplace thumbnails, and Lilly White, Cappuccino, Axanthic and White
  Wall are still not scored. Step 2 (the gold set) is what fixes those.
- **The test split was looked at once**, for these baselines only (no model,
  nothing tuned). The next look at test should be a release run with its
  metric written down first.
