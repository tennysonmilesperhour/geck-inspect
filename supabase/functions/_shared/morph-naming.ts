// How Morph ID names the leading pattern and fills its shortlist.
//
// Harlequin is the base pattern (Tennyson, 28 Sep 2026). It is so common that
// most other patterns sit on top of it, and breeders name the animal by the
// other pattern: a harlequin with full pinstripe is listed as a Pinstripe, a
// three-color harlequin as a Tricolor. Extreme and Super Harlequin are morphs
// in their own right and keep the lead. The reference labels follow the same
// rule (geck_data.pick_primary_morph, migration
// 20260928172832_harlequin_is_the_base), including its tie-break: when two
// patterns could lead, the first alphabetically wins.

import type { VisualEvidence } from "./morph-evidence.ts";

export type Candidate = {
  morph: string;
  score: number;
  why: string;
  source?: "model" | "photo_lookup" | "both";
};

const PINNING_PATTERN: Record<string, string> = {
  full: "pinstripe",
  partial: "partial_pinstripe",
  quad: "quad_stripe",
  reverse: "reverse_pinstripe",
  phantom: "phantom_pinstripe",
  super_stripe: "super_stripe",
};

const PINNING_REASON: Record<string, string> = {
  full: "full pinstripe",
  partial: "partial pinstripe",
  quad: "quad stripe",
  reverse: "reverse pinstripe",
  phantom: "phantom pinstripe",
  super_stripe: "super stripe",
};

// The pattern that leads when the model named plain Harlequin but also saw
// pinning or the tricolor look. Anything else passes through unchanged.
export function leadingPattern(
  modelPrimary: string | null,
  pinning: string | null | undefined,
  secondaryTraits: string[],
): { morph: string | null; reason: string | null } {
  if (modelPrimary !== "harlequin") return { morph: modelPrimary, reason: null };
  const options: Array<{ morph: string; reason: string }> = [];
  if (pinning && PINNING_PATTERN[pinning]) {
    options.push({ morph: PINNING_PATTERN[pinning], reason: PINNING_REASON[pinning] });
  }
  if (secondaryTraits.includes("tricolor")) {
    options.push({ morph: "tricolor", reason: "the tricolor look" });
  }
  if (options.length === 0) return { morph: modelPrimary, reason: null };
  options.sort((a, b) => a.morph.localeCompare(b.morph));
  return options[0];
}

// Shortlist of up to three: the leading pattern, then the Harlequin base it
// replaced (if any), then the photo lookup's leading patterns, then the
// model's other candidates. On run 17, keeping the model's first answer and
// filling the rest from the lookup put a breeder-tagged pattern in the top
// three 77% of the time, against 69% for the model's own three.
export function buildShortlist(
  leading: { morph: string | null; reason: string | null },
  modelPrimary: string | null,
  modelCandidates: Candidate[],
  evidence: VisualEvidence,
  allowed: string[],
  size = 3,
): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const fromModel = (morph: string | null) => modelCandidates.find((c) => c.morph === morph);
  const add = (candidate: Candidate | undefined) => {
    if (!candidate || !candidate.morph || seen.has(candidate.morph) || out.length >= size) return;
    seen.add(candidate.morph);
    out.push(candidate);
  };

  const modelTop = fromModel(modelPrimary);
  if (leading.morph && leading.morph !== modelPrimary) {
    add({
      morph: leading.morph,
      score: modelTop?.score ?? 0,
      why: `Harlequin base with ${leading.reason}. Breeders list this as the leading pattern.`,
      source: "model",
    });
    add(modelTop && { ...modelTop, why: `Base pattern. ${modelTop.why}`.trim(), source: "model" });
  } else if (leading.morph) {
    add(modelTop ? { ...modelTop, source: "model" } : { morph: leading.morph, score: 0, why: "", source: "model" });
  }

  const depth = evidence.ranking_depth ?? 0;
  for (const rank of evidence.status === "available" ? evidence.ranking ?? [] : []) {
    if (!allowed.includes(rank.primary_morph)) continue;
    const own = fromModel(rank.primary_morph);
    add(own
      ? { ...own, source: "both" }
      : {
        morph: rank.primary_morph,
        score: Math.round(rank.share * 100),
        why: `${rank.support} of the ${depth} closest breeder-tagged reference photos carry this pattern.`,
        source: "photo_lookup",
      });
  }

  for (const candidate of modelCandidates) add({ ...candidate, source: candidate.source ?? "model" });
  return out;
}
