# Morph observation review, October 14, 2026

## Scope and status

The revised notebook is local-review UI at `/DesignPreview#slider`. `App.jsx` imports that route only in development. The live `PatternSpectrum`, lessons and quiz are unchanged. The three new exports from `TraitGecko` share the existing asset loader and anatomical paths without changing its default rendering.

This is a concrete response to the earlier pattern-fidelity critique, not a claim of expert validation or a new 10/10 score.

## What changed

- Three guided observations use the founder's actual photographs: lateral/limb pattern, raised crest rows, and discrete spotting. Each has at least two different animals, original-record links, identifying-region markers and an uncropped, enlargable photo.
- Raindrop's two public photographs show opposite flanks of one individual. The learner can compare anatomical regions while seeing that markings need not mirror. Cropped tail bases and the missing overhead view are explicitly identified as limitations.
- Four different animals are reserved for the recognition check. They do not appear in the lessons, including alternate views. Names, keeper-record links, descriptive hints and annotations do not reveal the answer by default. First answers are locked, assisted answers counted separately, missing photos can be skipped, and repeats are labeled as practice.
- The review's cream/spot controls select connected pigment islands from the existing ink art at full strength. They no longer cut repeated geometric shapes through the patches or fade their opacity. Fine ink gaps are bridged only for grouping; this never paints new pixels.
- Partial pinning uses small, irregularly sized windows in uneven clusters within the existing crest mask. The near-side row shares its longitudinal selection with the top view. The opposite row differs. These are approximate windows over existing art, not a newly validated tracing of every crest scale.
- Controls snap to named drawing stages instead of showing percentages. Tiger's existing layer is shown/hidden at full strength; it is not a tiger-to-brindle severity control. A previous-rendering toggle makes the change inspectable.

## Evidence and terminology

1. [Pangea: harlequin](https://www.pangeareptile.com/collections/harlequin), checked October 14, 2026. Supports looking at ventral-to-dorsal lateral pattern; Pangea's “extreme” usage is a breeder convention, not a universal quantitative boundary.
2. [Pangea: pinstripe](https://www.pangeareptile.com/collections/pinstripe), checked October 14, 2026. Describes the raised dorsal rows and concentration of pattern color on those scales.
3. [LIL MONSTERS: Foundation Genetics, part 2](https://lmreptiles.com/fg-pt2-1/), checked October 14, 2026. A breeder-authored photograph library useful for observed variation. Proposed inheritance models are not treated as universal consensus.
4. Actual public source records and image provenance: `public/demo-geckos/README.md`, `public/morph-guide/specimen-studies/README.md`, and `reviewStudyData.js`.

No third-party reference photos were added to the new notebook. The source photographs were not recolored or pattern-edited.

## Acceptance before a dependable identification claim

The next acceptance test is transfer to real animals, not resemblance to the previous AI drawing:

- Have experienced keepers review each pinpointed observation, including ambiguous views, without being shown the intended answer first. Record disagreements and revise the wording or omit the example.
- Add well-documented complete and interrupted pinstripe specimens, including overhead and both side views. The current owners' photos teach location, but do not establish a full continuum of pinning.
- Add separately sourced, cleared specimen sets for flame/bicolor, tiger/brindle, low and high lateral coverage, and combinations. Do not treat the current three studies as comprehensive.
- Use different individuals for instruction and evaluation, not just different photos of the same animal. Include low contrast, lighting variation, partial occlusion, overlapping traits and legitimate “insufficient view” answers.
- Evaluate learners before and after instruction on a larger set of unfamiliar animals. The four-question demo checks the workflow; it does not measure general identification accuracy. Set any numerical acceptance target before collecting results.
- If top/side illustrations are to represent one animal, commission or produce registered drawings from a complete multi-angle specimen set. Matching control settings is not equivalent to matching all markings around one body.
- Verify that each discrete art stage looks credible and that changing pinning affects only the crest region. Whole-island rendering removes one artifact, but cannot by itself validate the underlying AI-assisted artwork.

## Verification

Focused tests cover disjoint animal sets, local image provenance, neutral pre-answer metadata, first-answer locking, hints and missing-image handling, complete pigment islands, unchanged pigment values, monotonic selections and bounded asymmetric pin clusters. Browser checks cover the full recognition flow, photo enlargement with Escape/focus restoration, named sliders, view changes, desktop and mobile layouts.
