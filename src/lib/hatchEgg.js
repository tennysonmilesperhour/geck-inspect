/**
 * The one way an egg hatches (feature completeness audit, step 23).
 *
 * Every screen that records a hatch (the Hatched button on a plan card,
 * the Hatchery's quick buttons, and choosing Hatched in the Egg Details
 * dialog) opens HatchEggDialog, which calls hatchEgg() below. So every
 * hatch produces the same gecko, the same dates and the same outcome log:
 *
 *   1. Create the hatchling in the member's collection (unless the egg is
 *      already linked to a gecko that still exists). The database refuses
 *      the insert for a Free member at the 10 gecko limit; that error is
 *      passed back untouched so the dialog can explain it, and the egg is
 *      left Incubating.
 *   2. Mark the egg Hatched with the hatch date the member chose, link the
 *      gecko, and archive the egg (resolved eggs live in the archive).
 *   3. When the member answered "What hatched?", add that answer to the
 *      pairing's outcome log. Eggs from the same clutch (same pair, same
 *      lay date) share one log row, so the "Prediction vs reality" panel
 *      counts clutches correctly.
 *
 * If step 2 fails after step 1 created a gecko, the new gecko is removed
 * again so a retry does not leave a duplicate behind.
 */
import { differenceInDays, format } from 'date-fns';
import { Egg, Gecko, PairingOutcomeLog } from '@/entities/all';
import { generateHatchedGeckoIdFromEgg } from '@/components/shared/geckoIdUtils';
import { outcomeLogKeys } from '@/lib/genetics/pairOutcomes';
import { parseLocalDate, todayLocalISO } from '@/lib/dateUtils';

/** The "What hatched?" answer for a hatchling that matches no prediction. */
export const OTHER_OUTCOME = 'other / unsure';

/** pairing_outcome_logs.eggs allows 1 to 4 eggs per row. */
const MAX_EGGS_PER_LOG = 4;

/** The note that ties outcome log rows to one clutch. */
export function clutchLogNote(plan, egg) {
  return `clutch:${plan?.id || 'none'}:${egg?.lay_date || 'unknown'}`;
}

/** Number of hatchlings this pair already has, for the default name. */
export function nextOffspringNumber(pairEggs = []) {
  return pairEggs.filter((e) => e && e.status === 'Hatched' && e.gecko_id).length + 1;
}

/** "Sire x Dam #3": the default hatchling name. */
export function defaultHatchlingName(sire, dam, pairEggs = []) {
  return `${sire?.name || 'Unknown'} x ${dam?.name || 'Unknown'} #${nextOffspringNumber(pairEggs)}`;
}

/**
 * Checks a hatch date: required, a real date, not before the lay date and
 * not in the future. Returns an error sentence, or null when it is fine.
 */
export function hatchDateProblem(hatchDate, egg, today = todayLocalISO()) {
  if (!hatchDate || !/^\d{4}-\d{2}-\d{2}$/.test(hatchDate)) return 'Choose the date the egg hatched.';
  if (hatchDate > today) return 'The hatch date cannot be in the future.';
  if (egg?.lay_date && hatchDate < String(egg.lay_date).slice(0, 10)) {
    return 'The hatch date cannot be before the egg was laid.';
  }
  return null;
}

/** The new gecko row. Exported so tests can check every field. */
export function buildHatchlingRecord({ egg, plan, sire, dam, pairEggs = [], hatchDate, name }) {
  const layDate = egg?.lay_date ? String(egg.lay_date).slice(0, 10) : null;
  const incubationDays = layDate
    ? differenceInDays(parseLocalDate(hatchDate), parseLocalDate(layDate))
    : null;
  const pairName = `${sire?.name || 'Unknown'} x ${dam?.name || 'Unknown'}`;
  const laidText = layDate ? ` from an egg laid ${format(parseLocalDate(layDate), 'MMM d, yyyy')}` : '';
  const record = {
    name: (name || '').trim() || defaultHatchlingName(sire, dam, pairEggs),
    gecko_id_code: generateHatchedGeckoIdFromEgg({ sire, dam, egg, allEggsForPair: pairEggs }),
    hatch_date: hatchDate,
    sex: 'Unsexed',
    sire_id: plan?.sire_id || sire?.id || null,
    dam_id: plan?.dam_id || dam?.id || null,
    status: 'Pet',
    morphs_traits: '',
    image_urls: [],
    notes: `Hatched ${format(parseLocalDate(hatchDate), 'MMM d, yyyy')}${laidText}. Pair: ${pairName}${plan?.breeding_id ? ` (${plan.breeding_id})` : ''}.`,
  };
  if (incubationDays != null && incubationDays >= 0) record.incubation_days = incubationDays;
  const species = dam?.species || sire?.species;
  if (species) record.species = species;
  return record;
}

function isDuplicateCodeError(error) {
  return error?.code === '23505' || /already used in your collection/i.test(error?.message || '');
}

async function createHatchling(record) {
  // The ID code is unique per owner. An older hatch flow used a different
  // format, so a clash is rare but possible: add a letter and try again.
  const base = record.gecko_id_code;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = attempt === 0 ? base : `${base}-${String.fromCharCode(97 + attempt)}`;
    try {
      return await Gecko.create({ ...record, gecko_id_code: code });
    } catch (error) {
      if (!isDuplicateCodeError(error) || attempt === 3) throw error;
    }
  }
  return null;
}

async function existingLinkedGecko(egg) {
  if (!egg?.gecko_id) return null;
  try {
    return await Gecko.get(egg.gecko_id);
  } catch {
    return null;
  }
}

/**
 * Adds one hatched egg's answer to the pairing's outcome log. Returns the
 * saved row, or null when there was nothing to log.
 */
export async function logHatchOutcome({ egg, plan, sire, dam, observed, predicted = [], hatchDate }) {
  const answer = String(observed || '').trim();
  if (!answer || !sire?.id || !dam?.id) return null;
  const keys = outcomeLogKeys(sire, dam);
  const note = clutchLogNote(plan, egg);
  const existing = await PairingOutcomeLog.filter({ pairing_key: keys.pairing_key, notes: note });
  const row = (existing || []).find((r) => (r.eggs || 0) < MAX_EGGS_PER_LOG);
  if (row) {
    const nextObserved = [...(row.observed || []), answer];
    return PairingOutcomeLog.update(row.id, {
      observed: nextObserved,
      eggs: nextObserved.length,
      hatched_on: hatchDate,
    });
  }
  return PairingOutcomeLog.create({
    sire_id: sire.id,
    dam_id: dam.id,
    ...keys,
    predicted: (predicted || []).map((o) => ({ label: o.label, probability: o.probability })),
    observed: [answer],
    eggs: 1,
    hatched_on: hatchDate,
    notes: note,
  });
}

/** Statuses for an egg that did not hatch. */
export const FAILED_EGG_STATUSES = ['Infertile', 'Slug', 'Stillbirth'];

/**
 * The fields to write when an egg's status changes to anything but
 * Hatched (Hatched goes through hatchEgg). A failed egg is resolved, so it
 * is archived; an egg set back to Incubating comes out of the archive and
 * loses its hatch date. A linked gecko is kept, so hatching it again later
 * reuses that gecko instead of adding a second one.
 */
export function eggStatusFields(status, today = todayLocalISO()) {
  if (status === 'Hatched') throw new Error('Use hatchEgg to mark an egg hatched.');
  if (status === 'Incubating') {
    return { status, archived: false, archived_date: null, hatch_date_actual: null };
  }
  return { status, archived: true, archived_date: today };
}

/**
 * Hatch an egg. See the file header for the steps.
 *
 * @returns {Promise<{ gecko: object, egg: object, outcomeLogged: boolean, outcomeError: Error|null }>}
 * @throws the database error when the gecko or the egg cannot be saved
 *         (check it with isGeckoLimitError from '@/lib/geckoLimit').
 */
export async function hatchEgg({ egg, plan, sire, dam, pairEggs = [], hatchDate, name, observed, predicted }) {
  if (!egg?.id) throw new Error('This egg could not be found.');
  const problem = hatchDateProblem(hatchDate, egg);
  if (problem) throw new Error(problem);
  if (!sire || !dam) {
    throw new Error("This egg's breeding plan is missing its sire or dam, so the hatchling cannot be added.");
  }

  let gecko = await existingLinkedGecko(egg);
  let createdNow = false;
  if (!gecko) {
    gecko = await createHatchling(buildHatchlingRecord({ egg, plan, sire, dam, pairEggs, hatchDate, name }));
    createdNow = true;
  } else if (gecko.hatch_date !== hatchDate) {
    // Re-hatching an egg that was set back to Incubating: keep its gecko
    // and bring the gecko's hatch date in line with the egg.
    gecko = (await Gecko.update(gecko.id, { hatch_date: hatchDate })) || gecko;
  }

  let updatedEgg;
  try {
    updatedEgg = await Egg.update(egg.id, {
      status: 'Hatched',
      hatch_date_actual: hatchDate,
      gecko_id: gecko.id,
      archived: true,
      archived_date: todayLocalISO(),
    });
  } catch (error) {
    if (createdNow) {
      await Gecko.delete(gecko.id).catch(() => {});
    }
    throw error;
  }

  let outcomeLogged = false;
  let outcomeError = null;
  try {
    outcomeLogged = !!(await logHatchOutcome({ egg, plan, sire, dam, observed, predicted, hatchDate }));
  } catch (error) {
    // The hatch itself is saved; the dialog says the answer was not.
    outcomeError = error;
  }

  if (createdNow && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('geckos_changed', { detail: { action: 'created', geckoId: gecko.id } }));
  }

  return { gecko, egg: updatedEgg || { ...egg, status: 'Hatched' }, outcomeLogged, outcomeError };
}
