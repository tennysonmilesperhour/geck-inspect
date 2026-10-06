/**
 * What a member's breeding has produced, in asking-price dollars: every
 * viable egg (hatched, or still incubating) across all plans, and the
 * ones from this season (the calendar year, decision D17). Shown as two
 * small numbers on the Breeding page.
 *
 * A hatched egg linked to its gecko is valued like that gecko (its traits,
 * age, sex and grade; src/lib/traitValuation.js). Otherwise an egg counts
 * at its pairing's expected value per egg (src/lib/pairingValue.js):
 * a hatched one at the value given that it survived, an incubating one at
 * the plain per-egg value, which already allows for lethal outcomes.
 */
import { pairingEggValue } from '@/lib/pairingValue';
import { qualityTierFor, valueFromTraitTable } from '@/lib/traitValuation';
import { currentSeasonYear, eggSeasonYear } from '@/lib/seasons';

function isViable(egg) {
  return egg.status === 'Hatched' || (!egg.archived && egg.status === 'Incubating');
}

export function productionValue({ plans = [], eggs = [], geckos = [], index, now = new Date() }) {
  const empty = { lifetime: 0, season: 0, lifetimeEggs: 0, seasonEggs: 0, unpriced: 0 };
  if (!index) return empty;
  const byId = new Map(geckos.map((g) => [g.id, g]));
  const planValue = new Map();
  const valueForPlan = (planId) => {
    if (planValue.has(planId)) return planValue.get(planId);
    const plan = plans.find((p) => p.id === planId);
    const v = plan ? pairingEggValue(byId.get(plan.sire_id), byId.get(plan.dam_id), index) : null;
    planValue.set(planId, v);
    return v;
  };

  const year = currentSeasonYear(now);
  const out = { ...empty };
  for (const egg of eggs) {
    if (!isViable(egg)) continue;
    let value = null;
    const hatched = egg.status === 'Hatched';
    const gecko = hatched && egg.gecko_id ? byId.get(egg.gecko_id) : null;
    if (gecko) {
      const priced = valueFromTraitTable(gecko, index, qualityTierFor(gecko), now);
      if (priced) value = priced.value;
    }
    if (value == null) {
      const pv = valueForPlan(egg.breeding_plan_id);
      if (pv) {
        value = hatched && pv.lethalShare < 1 ? pv.perEgg / (1 - pv.lethalShare) : pv.perEgg;
      }
    }
    if (value == null) { out.unpriced += 1; continue; }
    out.lifetime += value;
    out.lifetimeEggs += 1;
    if (eggSeasonYear(egg) === year) {
      out.season += value;
      out.seasonEggs += 1;
    }
  }
  out.lifetime = Math.round(out.lifetime);
  out.season = Math.round(out.season);
  return out;
}
