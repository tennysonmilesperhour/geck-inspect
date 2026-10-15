# Morph ID: product brief

Moved here from the root `PRODUCT.md` on 15 October 2026 (plan item E2 21 of `docs/planning/comprehensive-review-2026-10-14.md`). The brief was written for Morph ID, so it lives with the other feature specs; `PRODUCT.md` is now a short summary of the whole product. The text of the brief below is unchanged except for this header and the "Where it lives" section at the end.

## Register

product

## Users

Geck Inspect serves crested gecko keepers and breeders. The core audiences are hobbyists caring for a small collection, breeders managing pairings and lineage, and commercial teams responsible for larger collections. In Morph ID, users need a credible second opinion from a photo, clear evidence for the result, and a practical way to correct uncertain labels without needing machine-learning expertise.

## Product Purpose

Geck Inspect is a crested-gecko-first platform for collection care, breeding, genetics, lineage, marketplace activity, and morph identification. Morph ID should help a user understand what the image supports, what remains uncertain, and what additional evidence would improve the assessment. Success means the result is useful enough to guide recordkeeping while remaining honest about visual ambiguity and unconfirmed genetics.

## Brand Personality

Knowledgeable, grounded, and specific. The product should feel like a trusted breeder with strong recordkeeping habits: confident when the evidence is strong, candid when it is not, and generous with practical context. Copy uses short sentences, active voice, and correct crested gecko terminology.

## Anti-references

Do not resemble a generic reptile tracker, a novelty image classifier, or an opaque AI confidence meter. Avoid clinical white dashboards, decorative technology imagery, stock gecko illustrations, exaggerated accuracy claims, and flows that hide uncertainty behind one definitive label. Do not dilute the crested-gecko-first identity with generic animal examples.

## Design Principles

1. Show the evidence. Pair every identification with visible traits, comparable references, and plain-language reasoning.
2. Separate observation from inheritance. A photo can support phenotype traits, but genetics and het status require lineage or test-breeding evidence.
3. Make uncertainty useful. Explain why confidence is limited and tell the user which photo or detail would help next.
4. Let community expertise compound. Corrections and expert verification should improve both the user's record and the future training corpus.
5. Keep the next action obvious. Each state should lead naturally to another photo, a correction, an expert review, or saving the result.

## Accessibility & Inclusion

Target WCAG 2.2 AA. Morph ID must support keyboard operation, visible focus, screen-reader labels, reduced motion, high-contrast status communication, and touch targets of at least 44 by 44 pixels. Confidence and verification status cannot rely on color alone. The mobile camera workflow is a primary experience, not a desktop adaptation.

## Where it lives in the code (added 15 October 2026)

| Part | Files |
|---|---|
| The page members use | `src/pages/Recognition.jsx` (route `/Recognition`, with a capital R), components in `src/components/morph-id/` |
| The trait list it may return | `src/components/morph-id/morphTaxonomy.js`, mirrored in `supabase/functions/recognize-gecko-morph/taxonomy.ts` |
| The identification itself | `supabase/functions/recognize-gecko-morph` (Anthropic Claude vision plus similar-photo retrieval through Replicate). Its `README.md` documents the response shape, retrieval and deploy steps. It is declared in `supabase/config.toml`, so merging to `main` deploys it |
| Allowances and credits | `src/lib/tierLimits.js` (Free 1, Keeper 3, Breeder 6, Enterprise 15 a month, reset at midnight UTC on the 1st; decision 46), `src/lib/morphIdQuota.js`, SQL `consume_morph_id_credit` (uses 1 for Free whatever the function sends) and `morph_id_scans_remaining`, ledger `morph_id_usage`, extra scans in `morph_id_bonus_credits` |
| The shareable result card | The member taps Share on a result (`src/components/morph-id/MorphShareCard.jsx`). The database copies the card from the stored answer, never from the browser (`create_morph_id_share`, table `morph_id_shares`, migration `20261015151300_morph_id_share_card.sql`), and the card's photo must be one the answer read. The public page is `/morph-id/r/<id>`, served as real HTML by `api/morph-share.js` so link previews show the photo; it says "Visual traits, not proven genes" and links to Morph ID with the card id. The owner can take a card down. Events: `docs/planning/instrumentation-2026-10.md` |
| Corrections and training review | `src/pages/Training.jsx`, `MorphCorrectionPanel.jsx`, `AIFeedbackQueue.jsx` |
| Accuracy checks | `scripts/morph-id-eval/` and the hand-run `morph-id-eval` workflow (220 held-out geckos, about $6 a full run); the `daily-canary` workflow runs two real identifications each morning |

Done in round 2 of the 14 October review's plan (Part E, item 17): the shareable result card and one free identification a month. Card views are counted only once the Vault secret `morph_share_view_key` and the Vercel setting `MORPH_SHARE_VIEW_KEY` are set and production has been redeployed in Vercel after the setting was added (`docs/planning/deploy-queue-2026-10-03.md`).

Open work: an adjudicated, seller-disjoint gold set with a published accuracy number (item 29). The honest framing stays: visual traits, not proven genes.
