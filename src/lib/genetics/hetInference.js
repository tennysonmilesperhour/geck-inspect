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
 * For each recessive (and, for explicit het tags only, incomplete
 * dominant) trait, each ancestor that references that trait contributes
 * one independent "line" of carrier probability for the subject. Depth
 * d counts hops from the subject: a parent is d = 1, a grandparent
 * d = 2, a great-grandparent d = 3.
 *
 *   - Visual recessive ancestor (homozygous, shows the trait):
 *         p = 0.5 ^ (d - 1)
 *     A visual recessive PARENT passes one allele for certain, so the
 *     subject is 100% het (d = 1 -> 1.0). A visual recessive GRANDPARENT
 *     guarantees its child (the subject's parent) is het, and that
 *     parent passes the allele down with probability 0.5, so the subject
 *     is 50% het (d = 2 -> 0.5). A great-grandparent gives 25%
 *     (d = 3 -> 0.25).
 *
 *   - "Het X" tagged ancestor (one known copy, invisible):
 *         p = 0.5 ^ d
 *     A het PARENT passes the allele with probability 0.5 (d = 1 -> 0.5).
 *     A het grandparent: 0.5 to reach the parent, 0.5 again to the
 *     subject (d = 2 -> 0.25).
 *
 *   - "Possible Het X" tagged ancestor (50% confidence the tag holds):
 *         p = 0.5 * 0.5 ^ d
 *     A possible-het PARENT gives 0.25 (d = 1 -> 0.25). We treat the
 *     breeder's "possible" as a flat 0.5 confidence that the ancestor is
 *     actually het, then propagate as above.
 *
 * Multiple independent lines combine the standard way for "at least one
 * succeeds":  P = 1 - prod(1 - p_i).
 *
 * Incomplete dominants (Lilly White, Cappuccino, Sable, Highway, etc.)
 * are visible whenever a single copy is present, so there is no such
 * thing as a hidden het for them in the normal case. We therefore only
 * honor EXPLICIT "Het" / "Possible Het" tags on incomplete dominants,
 * which breeders use to record genuine uncertainty in low-expression
 * lines (a barely-visible Lilly White, say). We never invent a het for
 * an incomplete dominant from a visual ancestor, because a visual
 * ancestor of an incomplete dominant would itself be expressing it.
 *
 * Traits already visible on the subject are skipped: if the animal
 * already shows Axanthic, "might be het Axanthic" is meaningless.
 *
 * Only traits with a combined probability >= 0.1 are returned, sorted
 * highest-probability first.
 */

import {
  TRAITS,
  canonicalizeMorphTags,
} from './index.js';

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

// Confidence we assign to a "Possible Het" tag actually being het.
const POSSIBLE_HET_CONFIDENCE = 0.5;

// Minimum combined probability worth surfacing.
const MIN_PROBABILITY = 0.1;

/**
 * Classify a single canonicalized morph tag against a trait name.
 * Returns 'visual' | 'het' | 'possible_het' | null.
 *
 * Canonicalization (see genetics/index.js) guarantees het tags read
 * exactly "Het <Trait>" or "Possible Het <Trait>" and visual tags read
 * exactly "<Trait>".
 */
function classifyTag(tag, traitName) {
  if (typeof tag !== 'string') return null;
  const lower = tag.toLowerCase();
  const name = traitName.toLowerCase();
  if (lower === name) return 'visual';
  if (lower === `het ${name}`) return 'het';
  if (lower === `possible het ${name}`) return 'possible_het';
  return null;
}

/**
 * Per-source carrier probability for the subject, given how an ancestor
 * at `depth` references a trait. See the module header for the model.
 *
 * @param {'visual'|'het'|'possible_het'} kind
 * @param {number} depth, 1 = parent, 2 = grandparent, ...
 * @param {string} dominance, the trait's engine dominance
 * @returns {number} probability in [0, 1], or 0 if this source contributes nothing
 */
function sourceProbability(kind, depth, dominance) {
  if (kind === 'visual') {
    // A visual incomplete dominant ancestor is expressing the trait, not
    // hiding it, so it tells us nothing about a hidden het in the subject.
    if (dominance !== RECESSIVE) return 0;
    return 0.5 ** (depth - 1);
  }
  if (kind === 'het') {
    return 0.5 ** depth;
  }
  if (kind === 'possible_het') {
    return POSSIBLE_HET_CONFIDENCE * 0.5 ** depth;
  }
  return 0;
}

/**
 * Human-readable basis line for one contributing ancestor.
 */
function basisLine(label, kind, traitName) {
  const who = label || 'An ancestor';
  if (kind === 'visual') return `${who} is visual ${traitName}`;
  if (kind === 'het') return `${who} tagged Het ${traitName}`;
  if (kind === 'possible_het') return `${who} tagged Possible Het ${traitName}`;
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
 * @param {object} gecko, the subject (uses morph_tags to skip visible traits)
 * @param {Array<{ gecko: object, depth: number, relation: string }>} ancestry
 *   As returned by buildAncestry.
 * @returns {Array<{ traitName: string, probability: number, basis: string[] }>}
 *   Sorted by probability descending, only entries >= MIN_PROBABILITY.
 */
export function inferHiddenHets(gecko, ancestry = []) {
  // Traits the subject already shows, so we don't claim a het for them.
  const subjectVisible = new Set();
  const subjectTags = canonicalizeMorphTags(gecko?.morph_tags || []) || [];
  for (const tag of subjectTags) {
    for (const traitName of TRAIT_DOMINANCE.keys()) {
      if (classifyTag(tag, traitName) === 'visual') {
        subjectVisible.add(traitName);
      }
    }
  }

  // trait -> { lines: [{ p, basis }] }
  const byTrait = new Map();

  for (const entry of ancestry) {
    const { gecko: ancestor, depth, relation } = entry;
    if (!ancestor) continue;
    const tags = canonicalizeMorphTags(ancestor.morph_tags || []) || [];
    if (tags.length === 0) continue;

    for (const [traitName, dominance] of TRAIT_DOMINANCE.entries()) {
      if (subjectVisible.has(traitName)) continue;

      for (const tag of tags) {
        const kind = classifyTag(tag, traitName);
        if (!kind) continue;
        const p = sourceProbability(kind, depth, dominance);
        if (p <= 0) continue;

        let bucket = byTrait.get(traitName);
        if (!bucket) {
          bucket = { lines: [] };
          byTrait.set(traitName, bucket);
        }
        bucket.lines.push({ p, basis: basisLine(relation, kind, traitName) });
      }
    }
  }

  const results = [];
  for (const [traitName, bucket] of byTrait.entries()) {
    // Combine independent lines: P = 1 - prod(1 - p_i).
    const probability = 1 - bucket.lines.reduce((acc, line) => acc * (1 - line.p), 1);
    if (probability < MIN_PROBABILITY) continue;

    // De-duplicate identical basis strings, keep insertion order.
    const seenBasis = new Set();
    const basis = [];
    for (const line of bucket.lines) {
      if (seenBasis.has(line.basis)) continue;
      seenBasis.add(line.basis);
      basis.push(line.basis);
    }

    results.push({ traitName, probability, basis });
  }

  results.sort((a, b) => b.probability - a.probability);
  return results;
}
