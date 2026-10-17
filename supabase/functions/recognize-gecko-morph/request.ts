// The Anthropic request recognize-gecko-morph sends: the instructions, the
// tool schema, the reference-photo note and the order of the content blocks.
// Moved here unchanged from index.ts on 17 Oct 2026 so vitest can build the
// request without Deno's URL imports: src/lib/__tests__/morphRequestSnapshot.test.js
// compares it byte for byte with the request the function sent before the
// latency work. Any change here changes what the model reads before it
// answers, so it needs a graded run (docs/morph-id-eval/README.md) first.
import {
  PRIMARY_MORPH_IDS, PHOTO_GENETIC_TRAIT_IDS, SECONDARY_TRAIT_IDS,
  BASE_COLOR_IDS, PATTERN_INTENSITY_IDS, WHITE_AMOUNT_IDS,
  PATTERN_COLOR_IDS,
  FIRED_STATE_IDS, TAXONOMY_VERSION,
  PATTERN_FAMILY_IDS, PINNING_IDS, BANDING_IDS, SPOTTING_IDS,
  WHITE_PLACEMENT_IDS,
} from "./taxonomy.ts";
import type { VisualEvidence } from "../_shared/morph-evidence.ts";
import { requestShape, type RequestShape } from "../_shared/morph-upstream.ts";

export type FewShotExample = {
  image_url: string;
  primary_morph: string;
  base_color: string | null;
  gecko_name?: string | null;
  source: "hero_anchor" | "manual_touch";
};

export function buildRetrievalContext(evidence: VisualEvidence): string {
  if (evidence.status !== "available" || evidence.neighbors.length === 0) return "";
  const mapping = evidence.neighbors.map((neighbor, index) => {
    const traits = [
      ...neighbor.genetic_traits,
      ...neighbor.secondary_traits,
      neighbor.base_color,
    ].filter(Boolean).slice(0, 6).join(", ");
    const detail = traits ? `; other breeder tags=${traits}` : "";
    return `  ${index + 1}. breeder's main pattern=${neighbor.primary_morph}${detail}; similarity=${neighbor.similarity.toFixed(3)}`;
  }).join("\n");
  const vote = (evidence.ranking || []).slice(0, 3)
    .map((rank) => `${rank.primary_morph} ${Math.round(rank.share * 100)}%`).join(", ");
  const consensus = vote
    ? `Vote among the ${evidence.ranking_depth} closest reference photos (one per breeder): ${vote}.`
    : "No reference vote.";
  return `The ${evidence.neighbors.length} image(s) immediately before this note are the closest reference photos to the user's gecko, each tagged by the breeder who listed that animal. Breeder tags are reliable for those animals. A missing tag is unknown, not negative. Compare the user's gecko with them: a close reference can still differ in pattern, and the user's photos decide.\n${mapping}\n${consensus}`;
}

export function buildInstructions(fewShotBank: FewShotExample[], includeValueEstimate: boolean) {
  const bankIntro = fewShotBank.length === 0 ? "" :
    `\n\nFew-shot reference: the first ${fewShotBank.length} attached image(s) are LABELED reference examples (the user's photo(s) follow, after this text). Hero-anchor entries are competition-judged show winners (gold-standard visual definitions); manual-touch entries are community-verified examples. Use them as visual anchors for the canonical look of each primary_morph BEFORE evaluating the user's photo. The mapping, in order:\n${fewShotBank.map((ex, i) => {
      const tier = ex.source === "hero_anchor" ? " [hero]" : "";
      const name = ex.gecko_name ? ` "${ex.gecko_name}"` : "";
      const color = ex.base_color ? ` (base ${ex.base_color})` : "";
      return `  ${i + 1}. ${ex.primary_morph}${tier}${name}${color}`;
    }).join("\n")}`;

  const valueLine = includeValueEstimate
    ? `\n- value_estimate_usd_low / value_estimate_usd_high: a CONSERVATIVE retail price band in US dollars for an unrelated, unproven specimen at the apparent life stage, based on the morph quality you actually see in the photo. Reflect uncertainty by widening the band. value_estimate_notes is one sentence on what drives the band (e.g., "high white expression on a clean pin lifts this; unproven het knocks it down").`
    : "";

  return `You are a world-expert crested gecko (Correlophus ciliatus) visual morph
identification assistant. Analyze the user's photograph(s) and call the
\`submit_morph_analysis\` tool. Use only ids in the schema.

Rules:
- First assess whether the images show one crested gecko clearly enough for visual
  identification. Set usable_for_id=false for the wrong subject, multiple animals,
  severe blur, heavy obstruction, or lighting that prevents a responsible call.
- primary_morph is the best visual pattern-class candidate. If evidence is
  insufficient, provide a technical fallback but set usable_for_id=false. The app
  will withhold that fallback as an identification.
- visual_profile is the primary representation of what is actually visible.
  Classify pattern family, pinning, banding, and spotting independently because
  these traits can co-occur. Use unknown when the relevant body region is not
  visible; use none only when the region is visible and the trait is absent.
- pattern_color describes the visible pattern pigment separately from the base
  color. Use mixed when two distinct pattern colors are visible (for example,
  cream/white plus orange/yellow in a tricolor animal).
- Return one photo_observations entry for each user photo, in the same order.
  Inspect every photo separately before synthesizing. A poor or redundant image
  may have contributes_to_result=false and must not dilute a strong diagnostic
  view. Per-photo evidence_signal is a relative evidence-strength signal, not an
  accuracy percentage.
- Return up to three distinct candidate_morphs in descending visual-evidence order.
  Scores are relative model signals, not calibrated probabilities. Cite the visual
  feature that supports or weakens each candidate.
- Do not call harlequin for a flame, or extreme_harlequin without more than 60%
  leg pattern.
- genetic_traits is only for a trait whose visible phenotype is strongly expressed.
  A photo cannot prove genotype, carrier status, lineage, or hidden hets. Leave the
  array empty when lineage would be required. Use generic axanthic for a visible
  axanthic-like phenotype; never infer axanthic_vca or axanthic_tsm from photos.
  Phantom and Cream-on-Cream are visual-expression suggestions, not proof of their
  underlying genotype.
- Line-bred phenotypes, fired state and lighting make different morphs look alike.
  Cappuccino, Sable and Highway are widely reported to be forms of one gene, though
  that is not settled (Luwak is reported as Cappuccino plus Sable), and they
  overlap with line-bred dark or clean-backed animals; Lilly White overlaps with
  White Wall, Whiteout and line-bred high white. Only list sable, highway or luwak
  when the expression is strong and distinctive, and when a look-alike fits, say
  in uncertainty_reasons which look-alikes the photos cannot rule out and that recorded
  lineage settles it.
- secondary_traits is observational modifiers. Multiple allowed.
- Harlequin is the base pattern most other crested gecko patterns sit on. When a
  harlequin also shows another pattern, that pattern is primary_morph, the way
  breeders list the animal: full pinning is pinstripe, partial pinning is
  partial_pinstripe, four stripes are quad_stripe, and three distinct colors is
  tricolor. List harlequin as another candidate_morph. Extreme harlequin and super
  harlequin are morphs in their own right: keep them as primary_morph and list the
  other pattern as a candidate.
- tricolor means three distinct colors (the base plus two pattern colors, such as
  cream/white and orange/yellow) in roughly equal amounts, usually on a harlequin,
  sometimes a pinstripe. Add tricolor to secondary_traits whenever the three colors
  are present.
- evidence_markers must name concrete visible features such as dorsal coverage,
  leg coverage, pin continuity, spot count, flank pattern, and white placement.
- uncertainty_reasons must name missing views, ambiguous lookalikes, age effects,
  fired state, blur, glare, or color cast when relevant.
- confidence_score is a model signal about the top visual candidate, not the
  probability that the identification is correct. Reference photos carry the tags
  of the breeders who listed them; use them to see how breeders name a look, but
  the user's own photos decide.${valueLine}

Taxonomy version: ${TAXONOMY_VERSION}.${bankIntro}`;
}

export function buildTool(includeValueEstimate: boolean) {
  const properties: Record<string, unknown> = {
    primary_morph:     { type: "string", enum: PRIMARY_MORPH_IDS },
    genetic_traits:    { type: "array", items: { type: "string", enum: PHOTO_GENETIC_TRAIT_IDS } },
    secondary_traits:  { type: "array", items: { type: "string", enum: SECONDARY_TRAIT_IDS } },
    base_color:        { type: "string", enum: BASE_COLOR_IDS },
    pattern_intensity: { type: "string", enum: PATTERN_INTENSITY_IDS },
    white_amount:      { type: "string", enum: WHITE_AMOUNT_IDS },
    pattern_color:     { type: "string", enum: PATTERN_COLOR_IDS },
    fired_state:       { type: "string", enum: FIRED_STATE_IDS },
    confidence_score:  { type: "integer", minimum: 0, maximum: 100 },
    visual_profile: {
      type: "object",
      required: ["pattern_family", "pinning", "banding", "spotting", "white_cream_traits"],
      properties: {
        pattern_family: { type: "string", enum: PATTERN_FAMILY_IDS },
        pinning: { type: "string", enum: PINNING_IDS },
        banding: { type: "string", enum: BANDING_IDS },
        spotting: { type: "string", enum: SPOTTING_IDS },
        white_cream_traits: {
          type: "array",
          uniqueItems: true,
          items: { type: "string", enum: WHITE_PLACEMENT_IDS },
        },
      },
    },
    candidate_morphs:  {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        required: ["morph", "score", "why"],
        properties: {
          morph: { type: "string", enum: PRIMARY_MORPH_IDS },
          score: { type: "integer", minimum: 0, maximum: 100 },
          why: { type: "string", description: "Short visual evidence for or against this candidate." },
        },
      },
    },
    photo_observations: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        required: ["photo_number", "view", "quality_grade", "contributes_to_result", "evidence_signal", "visible_features", "limitations"],
        properties: {
          photo_number: { type: "integer", minimum: 1, maximum: 5 },
          view: { type: "string", enum: ["dorsal", "left_side", "right_side", "three_quarter", "head", "underside", "tail", "unclear"] },
          quality_grade: { type: "string", enum: ["good", "usable", "poor"] },
          contributes_to_result: { type: "boolean" },
          evidence_signal: { type: "integer", minimum: 0, maximum: 100 },
          visible_features: { type: "array", maxItems: 4, items: { type: "string" } },
          limitations: { type: "array", maxItems: 3, items: { type: "string" } },
        },
      },
    },
    evidence_markers:    { type: "array", maxItems: 6, items: { type: "string" } },
    uncertainty_reasons: { type: "array", maxItems: 5, items: { type: "string" } },
    photo_assessment: {
      type: "object",
      required: ["subject_is_crested_gecko", "usable_for_id", "quality_grade", "issues", "next_photo_needed"],
      properties: {
        subject_is_crested_gecko: { type: "boolean" },
        usable_for_id: { type: "boolean" },
        quality_grade: { type: "string", enum: ["good", "usable", "poor"] },
        issues: { type: "array", maxItems: 5, items: { type: "string" } },
        next_photo_needed: { type: "string", description: "The single most useful next photo, or an empty string." },
      },
    },
    explanation: { type: "string", description: "Two concise sentences grounded in visible evidence and uncertainty." },
  };
  if (includeValueEstimate) {
    properties.value_estimate_usd_low = {
      type: "integer", minimum: 0,
      description: "Conservative low end of retail price band in USD for an unrelated, unproven specimen at apparent life stage.",
    };
    properties.value_estimate_usd_high = {
      type: "integer", minimum: 0,
      description: "Conservative high end of retail price band in USD.",
    };
    properties.value_estimate_notes = {
      type: "string",
      description: "One sentence on what drives the price band.",
    };
  }
  return {
    name: "submit_morph_analysis",
    description: "Submit the structured morph analysis for this crested gecko photo.",
    input_schema: {
      type: "object",
      required: [
        "primary_morph", "confidence_score", "candidate_morphs",
        "visual_profile", "evidence_markers", "uncertainty_reasons",
        "photo_observations", "photo_assessment", "explanation",
      ],
      properties,
    },
  };
}

/**
 * The request body for one analysis, as an object (index.ts sends it as
 * JSON), and the model-specific shape it was built with (see requestShape).
 */
export function buildClaudeRequest(input: {
  bank: FewShotExample[];
  imageUrls: string[];
  includeValueEstimate: boolean;
  model: string;
  context: { ageStage: string; firedState: string };
  visualEvidence: VisualEvidence;
}): { body: Record<string, unknown>; shape: RequestShape } {
  const { bank, imageUrls, includeValueEstimate, model, context, visualEvidence } = input;
  // Cacheable block: bank images + bank-intro + rules text. Stable
  // across calls within the warm-instance lifetime (and across cold
  // starts as long as the bank composition + includeValueEstimate are
  // unchanged). The instructions text always exists (the no-bank
  // baseline still ships rules), so this block is always non-empty and
  // safe to anchor the cache on. Marking the LAST cacheable block with
  // cache_control: ephemeral caches everything up to and including it
  // for 5 minutes; subsequent requests pay 10% of input rate for that
  // prefix.
  const cacheableContent: Record<string, unknown>[] = [
    ...bank.map((ex) => ({ type: "image", source: { type: "url", url: ex.image_url } })),
    { type: "text", text: buildInstructions(bank, includeValueEstimate) },
  ];
  cacheableContent[cacheableContent.length - 1] = {
    ...cacheableContent[cacheableContent.length - 1],
    cache_control: { type: "ephemeral" },
  };

  // Variable block: query-specific visual neighbors followed by the user
  // images and a per-call trailing hint. Never cached because retrieval
  // changes with every request.
  const retrievalNeighbors = visualEvidence.status === "available"
    ? visualEvidence.neighbors.slice(0, 3)
    : [];
  const retrievalBlocks: Record<string, unknown>[] = retrievalNeighbors.length > 0
    ? [
      ...retrievalNeighbors.map((neighbor) => ({
        type: "image",
        source: { type: "url", url: neighbor.image_url },
      })),
      { type: "text", text: buildRetrievalContext({
        ...visualEvidence,
        neighbors: retrievalNeighbors,
      }) },
    ]
    : [];
  const userBlocks: Record<string, unknown>[] = imageUrls.map((url) => (
    { type: "image", source: { type: "url", url } }
  ));
  const photoText = imageUrls.length > 1
    ? `The immediately preceding ${imageUrls.length} images are of the same user-submitted animal. Synthesize across them.`
    : `The immediately preceding image is the user's submitted animal.`;
  const trailingText = `${photoText} User-provided context: life stage=${context.ageStage}; fired state=${context.firedState}. Treat unknown values as unavailable context. Call the tool with your analysis.`;
  const variableContent: Record<string, unknown>[] = [
    ...retrievalBlocks,
    ...userBlocks,
    { type: "text", text: trailingText },
  ];

  const tool = buildTool(includeValueEstimate);
  // Newer models reject a forced tool call and think before answering; see
  // requestShape, which also sets the ceiling on the answer's length
  // (FORCED_TOOL_MAX_TOKENS; output is billed as used, so a higher ceiling
  // is free).
  const shape = requestShape(model, tool.name);
  if (shape.callInstruction) {
    const last = variableContent[variableContent.length - 1] as { type: string; text: string };
    variableContent[variableContent.length - 1] = { ...last, text: last.text + shape.callInstruction };
  }
  const body = {
    model,
    max_tokens: shape.maxTokens,
    tools: [tool],
    tool_choice: shape.toolChoice,
    ...(shape.outputConfig ? { output_config: shape.outputConfig } : {}),
    messages: [{
      role: "user",
      content: [...cacheableContent, ...variableContent],
    }],
  };
  return { body, shape };
}
