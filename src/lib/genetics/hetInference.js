/**
 * Hidden-het inference: "what could this animal be carrying?"
 *
 * Crested gecko recessive traits (Axanthic, Phantom, Red Base, ChoCho,
 * Pixel per the Foundation Genetics engine) only show when an animal
 * carries two copies. A single hidden copy ("het", short for
 * heterozygous) is invisible to the eye but can surface in offspring.
 * Breeders track these as "Het Axanthic" or "Possible Het Axanthic"
 * tags. This module estimates, from recorded lineage alone, the odds a
 * given gecko is secretly carrying each recessive allele.
 *
 * It is a probability estimate from pedigree bookkeeping, not a genetic
 * test. The output is meant to prompt a breeding trial, not to assert a
 * fact.
 *
 * ---------------------------------------------------------------------
 * The model
 * ---------------------------------------------------------------------
 * We walk up to `maxDepth` generations of ancestors (default 3: parents,
 * grandparents, great-grandparents). Every ancestor's morph_tags are
 * canonicalized through the genetics adapter, so spelling variants and
 * "Het" / "Possible Het" prefixes normalize to the engine's trait names.
 *
 * The pedigree is treated as a family tree, not a list. For each trait we
 * work out, for every recorded animal, the chance it carries 0, 1 or 2
 * copies of the allele, starting at the oldest ancestors and moving down
 * one generation at a time:
 *
 *   1. An animal's OWN tag is the best evidence about it, so it wins:
 *        visual "Axanthic"         -> 2 copies for certain
 *        "Het Axanthic"            -> 1 copy for certain (breeders use
 *                                     this for a proven carrier)
 *        "Possible Het Axanthic"   -> 1 copy with 50% confidence
 *        "66% Het Axanthic"        -> 1 copy with 66% confidence
 *      A tag already sums up that animal's own background (a breeder
 *      tags a sire "Het Axanthic" BECAUSE his dam was Axanthic), so once
 *      an animal has a definite tag we do not also count its parents.
 *      Counting both would add the same path twice. That was the bug in
 *      the old version: a Het Axanthic sire with a visual Axanthic dam
 *      read as 75% for the subject when the true figure is 50%.
 *      The one exception: when a "Possible Het" (or percentage) tag is
 *      weaker than what the recorded parents prove, we use the parents,
 *      because the parents are the stronger evidence (a "Possible Het"
 *      out of a visual parent is in fact a certain het).
 *
 *   2. An untagged animal's odds come from its parents. Each parent hands
 *      down the allele with chance t = P(2 copies) + 0.5 * P(1 copy), and
 *      the two parents act independently:
 *        P(2 copies) = tSire * tDam
 *        P(1 copy)   = tSire * (1 - tDam) + (1 - tSire) * tDam
 *      Missing or unrecorded parents count as non-carriers (t = 0), the
 *      same "untagged means normal" assumption the calculator makes.
 *
 *   3. For recessive traits, an animal we can see is NOT visual cannot be
 *      carrying two copies, so we condition on that:
 *        P(het | not visual) = P(1 copy) / (1 - P(2 copies))
 *      This is why a normal-looking baby from Het x Het is 2/3 het
 *      (about 67%), not 3/4. We apply it to the subject always, and to
 *      any recorded ancestor that has at least one morph tag (an animal
 *      with no tags at all might simply never have been described).
 *
 * The subject's result is the chance it carries at least one hidden copy.
 *
 * Worked examples (these are the unit tests):
 *   Het sire x normal dam                          -> 50%
 *   Visual sire x normal dam                       -> 100% (shown as a
 *                                                     certainty, not a
 *                                                     "possible" het)
 *   Het x Het, normal-looking baby                 -> 2/3, about 67%
 *   Het sire (whose own dam is visual) x normal    -> 50%, not 75%
 *   Untagged sire out of visual grandparent        -> 50%
 *   Sire tagged only with other traits (so known not to be Axanthic)
 *   out of Het x Het grandparents                  -> 2/3 * 1/2 = 1/3
 *
 * Inbreeding: if the same ancestor appears on both sides, we treat the
 * two paths as independent. That is the usual simplification for a
 * three-generation pedigree and can overstate the odds slightly.
 *
 * Incomplete dominants (Lilly White, Cappuccino, Sable, Highway, etc.)
 * are visible whenever a single copy is present, so there is no such
 * thing as a hidden het for them in the normal case. We therefore only
 * honor EXPLICIT "Het" / "Possible Het" tags on incomplete dominants,
 * which breeders use to record genuine uncertainty in low-expression
 * lines (a barely-visible Lilly White, say). We never invent a het for
 * an incomplete dominant from a visual ancestor, because a visual
 * ancestor of an incomplete dominant would itself be expressing it, and
 * we do not apply the "not visual" step to them.
 *
 * Traits already visible on the subject are skipped: if the animal
 * already shows Axanthic, "might be het Axanthic" is meaningless.
 *
 * Only traits with a probability >= 0.1 are returned, sorted
 * highest-probability first.
 */

import {
  TRAITS,
  canonicalizeMorphTag,
  canonicalizeMorphTags,
} from './index.js';
import { POSSIBLE_HET_CHANCE } from '../hetUtils.js';

const RECESSIVE = 'recessive';
const INCOMPLETE_DOMINANT = 'incomplete_dominant';

// Trait name -> dominance, for the traits we reason about.
const TRAIT_DOMINANCE = (() => {
  const map = new Map();
  for (const trait of TRAITS) {
    if (trait.dominance === RECESSIVE || trait.dominance === INCOMPLETE_DOMINANT) {
      map.set(trait.name, trait.dominance);
    }
  }
  return map;
})();

// Confidence we assign to a "Possible Het" tag actually being het. Shared
// with the calculator's tag reading and the profile badges.
const POSSIBLE_HET_CONFIDENCE = POSSIBLE_HET_CHANCE;

// Minimum probability worth surfacing.
const MIN_PROBABILITY = 0.1;

// Label for the animal being looked at; ancestors get "Sire", "Dam's sire"...
const SUBJECT_LABEL = 'Subject';

// "66% Het Axanthic", "50 % het Phantom": breeder shorthand for a
// carrier with a stated chance. Canonicalization leaves these untouched,
// so we read them here.
const PERCENT_HET_RE = /^(\d{1,3})\s*%\s*(?:het\s+)?(.+)$/i;

/**
 * Classify a single canonicalized morph tag against a trait name.
 * Returns { kind: 'visual' | 'het' | 'possible_het', chance } or null,
 * where `chance` is how sure the tag is that the animal carries one copy
 * (only meaningful for het kinds).
 *
 * Canonicalization (see genetics/index.js) guarantees het tags read
 * exactly "Het <Trait>" or "Possible Het <Trait>" and visual tags read
 * exactly "<Trait>".
 */
function classifyTag(tag, traitName) {
  if (typeof tag !== 'string') return null;
  const lower = tag.toLowerCase();
  // Compare against the app spelling the tags are stored in ("Soft Scale",
  // not the engine's "Softscale").
  const name = (canonicalizeMorphTag(traitName) || traitName).toLowerCase();
  if (lower === name) return { kind: 'visual', chance: 1 };
  if (lower === `het ${name}`) return { kind: 'het', chance: 1 };
  if (lower === `possible het ${name}`) {
    return { kind: 'possible_het', chance: POSSIBLE_HET_CONFIDENCE };
  }
  const pct = tag.match(PERCENT_HET_RE);
  if (pct && /het/i.test(tag)) {
    const body = canonicalizeMorphTag(pct[2]);
    if (typeof body === 'string' && body.toLowerCase() === name) {
      const chance = Math.max(0, Math.min(100, Number(pct[1]))) / 100;
      if (chance >= 1) return { kind: 'het', chance: 1 };
      if (chance > 0) return { kind: 'possible_het', chance };
    }
  }
  return null;
}

/**
 * The strongest tag an animal carries for one trait (visual beats het
 * beats possible het), or null when its tags say nothing about it.
 */
function strongestTag(tags, traitName) {
  let best = null;
  const rank = { visual: 3, het: 2, possible_het: 1 };
  for (const tag of tags) {
    const found = classifyTag(tag, traitName);
    if (!found) continue;
    if (
      !best ||
      rank[found.kind] > rank[best.kind] ||
      (found.kind === best.kind && found.chance > best.chance)
    ) {
      best = found;
    }
  }
  return best;
}

// Genotype odds for one animal at one trait: chance of 0, 1 or 2 copies.
const NON_CARRIER = Object.freeze({ zero: 1, one: 0, two: 0 });

/** Chance an animal passes one copy of the allele to a given baby. */
function transmission(dist) {
  return dist.two + 0.5 * dist.one;
}

/** Odds for a baby from two parents' transmission chances (step 2). */
function childFromParents(tSire, tDam) {
  return {
    two: tSire * tDam,
    one: tSire * (1 - tDam) + (1 - tSire) * tDam,
    zero: (1 - tSire) * (1 - tDam),
  };
}

/**
 * Condition on "this animal does not show the recessive trait" (step 3).
 * If the parents make a visual baby certain but the animal is not tagged
 * visual, the tags disagree with the pedigree; we keep the unconditioned
 * odds rather than divide by zero, which still says "certainly carries".
 */
function conditionNotVisual(dist) {
  const notVisual = 1 - dist.two;
  if (notVisual <= 1e-9) return dist;
  return { zero: dist.zero / notVisual, one: dist.one / notVisual, two: 0 };
}

/**
 * Human-readable basis line for one contributing ancestor.
 */
function basisLine(label, found, traitName) {
  const who = label || 'An ancestor';
  const { kind, chance } = found;
  if (kind === 'visual') return `${who} is visual ${traitName}`;
  if (kind === 'het') return `${who} tagged Het ${traitName}`;
  if (kind === 'possible_het') {
    if (chance === POSSIBLE_HET_CONFIDENCE) return `${who} tagged Possible Het ${traitName}`;
    return `${who} tagged ${Math.round(chance * 100)}% Het ${traitName}`;
  }
  return `${who} references ${traitName}`;
}

/**
 * Fetch up to `maxDepth` generations of ancestors for a gecko.
 *
 * Walks sire_id / dam_id, batching each generation with one
 * Gecko.filter({ id: { $in: [...] } }) call (the Supabase entity layer
 * maps $in to PostgREST `.in`). Free-text sire_name / dam_name are NOT
 * fetched as records, but they ARE captured as relationship labels so a
 * downstream consumer could surface them; for het math we only use
 * linked records, since a free-text name carries no morph_tags.
 *
 * @param {string} geckoId
 * @param {{ maxDepth?: number, GeckoEntity: any }} opts
 *   GeckoEntity is injected (the Gecko entity from '@/entities/all') so
 *   this stays unit-testable with a mock.
 * @returns {Promise<Array<{ gecko: object, depth: number, relation: string }>>}
 *   Flat list of ancestor records with their depth (1 = parent) and a
 *   relation label ("Dam", "Sire's sire", ...). Excludes the subject.
 */
export async function buildAncestry(geckoId, { maxDepth = 3, GeckoEntity } = {}) {
  if (!geckoId || !GeckoEntity) return [];

  const ancestors = [];
  const seen = new Set([geckoId]);

  // Each frontier entry: { id, depth, relation }.
  let frontier = [{ id: geckoId, depth: 0, relation: 'Subject' }];

  while (frontier.length > 0) {
    const nextDepth = frontier[0].depth + 1;
    if (nextDepth > maxDepth) break;

    // We need the actual records for the current frontier to read their
    // sire_id / dam_id. Depth 0 is the subject (we don't have it here),
    // so for depth 0 we must fetch it; for deeper levels we already hold
    // the records. To keep one consistent path, fetch every frontier id
    // in a single batched call.
    const ids = frontier.map((f) => f.id).filter(Boolean);
    if (ids.length === 0) break;

    let records = [];
    try {
      records =
        ids.length === 1
          ? [await GeckoEntity.get(ids[0])].filter(Boolean)
          : await GeckoEntity.filter({ id: { $in: ids } });
    } catch {
      records = [];
    }

    const recordById = new Map(records.map((r) => [r.id, r]));

    const newFrontier = [];
    for (const node of frontier) {
      const rec = recordById.get(node.id);
      if (!rec) continue;

      const parents = [
        { id: rec.sire_id, kind: 'sire', name: rec.sire_name },
        { id: rec.dam_id, kind: 'dam', name: rec.dam_name },
      ];

      for (const parent of parents) {
        if (!parent.id || seen.has(parent.id)) continue;
        seen.add(parent.id);
        const relation = relationLabel(node.relation, parent.kind, nextDepth);
        newFrontier.push({ id: parent.id, depth: nextDepth, relation });
      }
    }

    if (newFrontier.length === 0) break;

    // Fetch the new ancestors' full records now so callers (inference)
    // have morph_tags without another round trip. Batched.
    const newIds = newFrontier.map((n) => n.id);
    let newRecords = [];
    try {
      newRecords =
        newIds.length === 1
          ? [await GeckoEntity.get(newIds[0])].filter(Boolean)
          : await GeckoEntity.filter({ id: { $in: newIds } });
    } catch {
      newRecords = [];
    }
    const newById = new Map(newRecords.map((r) => [r.id, r]));

    const resolvedFrontier = [];
    for (const node of newFrontier) {
      const rec = newById.get(node.id);
      if (!rec) continue;
      ancestors.push({ gecko: rec, depth: node.depth, relation: node.relation });
      resolvedFrontier.push({ id: node.id, depth: node.depth, relation: node.relation });
    }

    frontier = resolvedFrontier;
  }

  return ancestors;
}

/**
 * Build a relation label like "Dam", "Sire's sire", "Dam's dam's sire".
 * Depth 1 uses the bare role; deeper levels chain possessives.
 */
function relationLabel(parentRelation, kind, depth) {
  const role = kind === 'sire' ? 'sire' : 'dam';
  if (depth === 1) {
    return kind === 'sire' ? 'Sire' : 'Dam';
  }
  // parentRelation is the label of the child this ancestor is a parent of.
  return `${parentRelation}'s ${role}`;
}

/**
 * Infer hidden hets for a gecko from its ancestry.
 *
 * @param {object} gecko, the subject (uses morph_tags to skip visible
 *   traits, and sire_id / dam_id to place its parents in the tree)
 * @param {Array<{ gecko: object, depth: number, relation: string }>} ancestry
 *   As returned by buildAncestry. Each ancestor's own sire_id / dam_id
 *   links it to the generation above. When an animal has no parent ids we
 *   fall back to the relation labels ("Sire", "Sire's dam", ...) to
 *   rebuild the tree.
 * @returns {Array<{ traitName: string, probability: number, basis: string[] }>}
 *   Sorted by probability descending, only entries >= MIN_PROBABILITY.
 */
export function inferHiddenHets(gecko, ancestry = []) {
  const subjectTags = canonicalizeMorphTags(gecko?.morph_tags || []) || [];

  // Index ancestors by id and by relation label so we can walk the tree.
  const byId = new Map();
  const relationById = new Map();
  const byRelation = new Map();
  for (const entry of ancestry || []) {
    const rec = entry?.gecko;
    if (!rec) continue;
    if (rec.id != null) {
      byId.set(rec.id, rec);
      relationById.set(rec.id, entry.relation);
    }
    if (entry.relation) byRelation.set(entry.relation, rec);
  }

  const tagCache = new Map();
  const tagsFor = (rec) => {
    if (!tagCache.has(rec)) {
      tagCache.set(rec, canonicalizeMorphTags(rec.morph_tags || []) || []);
    }
    return tagCache.get(rec);
  };

  // The recorded sire and dam of an animal, each { rec, label } or null.
  function parentsOf(rec, label) {
    return ['sire', 'dam'].map((role) => {
      const roleLabel =
        label === SUBJECT_LABEL ? (role === 'sire' ? 'Sire' : 'Dam') : `${label}'s ${role}`;
      const id = rec?.[`${role}_id`];
      if (id != null) {
        const parent = byId.get(id);
        return parent ? { rec: parent, label: relationById.get(id) || roleLabel } : null;
      }
      const parent = byRelation.get(roleLabel);
      return parent ? { rec: parent, label: roleLabel } : null;
    });
  }

  const results = [];
  for (const [traitName, dominance] of TRAIT_DOMINANCE.entries()) {
    const isRecessive = dominance === RECESSIVE;

    // Skip traits the subject already shows.
    if (strongestTag(subjectTags, traitName)?.kind === 'visual') continue;

    const memo = new Map();
    const visiting = new Set();

    // Genotype odds for one animal plus the evidence lines behind them.
    function evaluate(rec, label, isSubject) {
      if (memo.has(rec)) return memo.get(rec);
      // Guard against a corrupt pedigree that loops back on itself.
      if (visiting.has(rec)) return { dist: NON_CARRIER, basis: [] };
      visiting.add(rec);

      const tags = isSubject ? subjectTags : tagsFor(rec);
      // The subject's own Het tags are not inference (the profile already
      // shows them), so for the subject we only ask what the lineage says.
      const own = isSubject ? null : strongestTag(tags, traitName);

      let result;
      if (own?.kind === 'visual') {
        // Step 1. A visual incomplete dominant is expressing the trait, not
        // hiding it, so it says nothing about a hidden copy.
        result = isRecessive
          ? { dist: { zero: 0, one: 0, two: 1 }, basis: [basisLine(label, own, traitName)] }
          : { dist: NON_CARRIER, basis: [] };
      } else if (own?.kind === 'het') {
        // Step 1. A definite Het tag settles it; its parents are not
        // counted again.
        result = { dist: { zero: 0, one: 1, two: 0 }, basis: [basisLine(label, own, traitName)] };
      } else {
        // Step 2: work it out from the parents.
        const [sire, dam] = parentsOf(rec, label);
        const sireRes = sire ? evaluate(sire.rec, sire.label, false) : null;
        const damRes = dam ? evaluate(dam.rec, dam.label, false) : null;
        let dist = childFromParents(
          sireRes ? transmission(sireRes.dist) : 0,
          damRes ? transmission(damRes.dist) : 0,
        );
        // Step 3: an animal we can see is not visual has at most one copy.
        // The subject always counts as seen; an ancestor only when it has
        // at least one morph tag.
        if (isRecessive && (isSubject || tags.length > 0)) {
          dist = conditionNotVisual(dist);
        }
        let basis = [...(sireRes?.basis || []), ...(damRes?.basis || [])];

        // Step 1 exception: a Possible Het or percentage tag is used only
        // when it says more than the recorded parents already prove.
        if (own?.kind === 'possible_het' && own.chance > dist.one + dist.two) {
          dist = { zero: 1 - own.chance, one: own.chance, two: 0 };
          basis = [basisLine(label, own, traitName)];
        }
        result = { dist, basis };
      }

      visiting.delete(rec);
      memo.set(rec, result);
      return result;
    }

    const { dist, basis } = evaluate(gecko || {}, SUBJECT_LABEL, true);
    const probability = Math.min(1, dist.one + dist.two);
    if (probability < MIN_PROBABILITY) continue;

    // De-duplicate identical basis strings, keep insertion order.
    results.push({ traitName, probability, basis: [...new Set(basis)] });
  }

  results.sort((a, b) => b.probability - a.probability);
  return results;
}
