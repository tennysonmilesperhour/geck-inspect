/**
 * The signed-in breeder's incubating clutches, shaped for the Market
 * Analytics "Your pipeline" card: one entry per breeding pair with its
 * egg count, the earliest expected hatch date, and the market traits the
 * parents carry.
 *
 * Trait matching reuses the Portfolio's trait value index (taxonomy names
 * plus synonyms, so "Tricolor" finds Tri-color). If that index cannot be
 * loaded, the market trait names alone are matched.
 */
import { Egg, BreedingPlan } from '@/entities/all';
import { getVisibleGeckos } from '@/lib/geckoAccess';
import { getEstimatedHatchDates } from '@/lib/incubationProfiles';
import { loadTraitValueIndex } from '@/lib/traitValueTable';
import { buildTraitValueIndex, matchGeckoTraits } from '@/lib/traitValuation';

function fallbackIndex(aggregates) {
  return buildTraitValueIndex(aggregates.traits.map((t) => ({
    trait: t.name, aliases: [], age_class: 'any', sex_class: 'any',
    n: t.n, p25: t.p25, p50: t.median, p75: t.p75,
  })));
}

const toIso = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null);

export async function loadPipeline(user, aggregates) {
  if (!user?.email) return [];
  const [eggs, plans, geckos] = await Promise.all([
    Egg.filter({ created_by: user.email }),
    BreedingPlan.filter({ created_by: user.email }),
    getVisibleGeckos(user),
  ]);
  const incubating = (eggs || []).filter((e) => e.status === 'Incubating' && !e.archived);
  if (incubating.length === 0) return [];

  let index;
  try {
    index = await loadTraitValueIndex();
  } catch {
    index = fallbackIndex(aggregates);
  }
  const marketNames = new Map(aggregates.traits.map((t) => [t.name.toLowerCase(), t.name]));
  const traitsOf = (gecko) => (gecko ? matchGeckoTraits(gecko, index) : [])
    .map((key) => marketNames.get(String(key).toLowerCase()))
    .filter(Boolean);

  const planById = new Map((plans || []).map((p) => [p.id, p]));
  const geckoById = new Map((geckos || []).map((g) => [g.id, g]));
  const groups = new Map();
  for (const egg of incubating) {
    const key = egg.breeding_plan_id || 'unassigned';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(egg);
  }

  return [...groups.entries()].map(([planId, clutchEggs]) => {
    const plan = planById.get(planId);
    const sire = plan ? geckoById.get(plan.sire_id) : null;
    const dam = plan ? geckoById.get(plan.dam_id) : null;
    const traits = [...new Set([...traitsOf(sire), ...traitsOf(dam)])];
    const dues = clutchEggs
      .map((e) => e.hatch_date_expected
        || toIso(getEstimatedHatchDates(e.lay_date, user.incubation_temperature_range)?.estimated))
      .filter(Boolean)
      .sort();
    return {
      id: planId,
      pair: plan ? `${sire?.name || 'Unknown sire'} x ${dam?.name || 'Unknown dam'}` : 'Eggs without a pairing',
      traits,
      eggs: clutchEggs.length,
      due: dues[0] || null,
    };
  }).sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')));
}
