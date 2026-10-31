/**
 * Which male an egg (and its clutch) came from.
 *
 * A breeding plan pairs one sire with one dam, and an egg belongs to a
 * plan. A crested gecko female can store sperm for months, so after a pair
 * change her first clutches with the new male can be from the earlier one.
 * Each egg can therefore record its own sire (eggs.sire_id, empty means the
 * plan's sire) and a possible other sire when the breeder is not sure
 * (eggs.possible_sire_id). Migration
 * supabase/migrations/20261031010100_egg_sire.sql adds both columns.
 *
 * A clutch is the eggs of one plan laid on the same day. Sperm storage is
 * about the clutch, not one egg, so the app writes both values on every egg
 * of the clutch together.
 *
 * The hatchling takes the egg's sire (src/lib/hatchEgg.js). When a possible
 * sire is recorded, its genetics notes carry a "Sire not confirmed" line,
 * which the passport shows next to the lineage.
 */

/** How long before a clutch an earlier pairing still counts as a possible father. */
export const SPERM_RETENTION_DAYS = 365;

/** The first words of the hatchling's genetics-notes line for an unconfirmed sire. */
export const UNCONFIRMED_SIRE_PREFIX = 'Sire not confirmed:';

const day = (value) => (value ? String(value).slice(0, 10) : null);
const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromIso, toIso) {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / DAY_MS);
}

/** The sire id an egg counts as coming from: its own, or the plan's. */
export function effectiveSireId(egg, plan) {
  return egg?.sire_id || plan?.sire_id || null;
}

/** The eggs of the same clutch as `egg` (same plan, same lay date), `egg` included. */
export function clutchEggs(egg, pairEggs = []) {
  if (!egg) return [];
  const planId = egg.breeding_plan_id;
  const laid = day(egg.lay_date);
  const mates = (pairEggs || []).filter(
    (e) => e && e.id !== egg.id && e.breeding_plan_id === planId && day(e.lay_date) === laid,
  );
  return [egg, ...mates];
}

/**
 * The last day this plan's pair is known to have been together: the latest
 * of its pairing date and its recorded copulations. Null when none is known.
 */
export function lastContactDate(plan) {
  const dates = [day(plan?.pairing_date)];
  for (const event of plan?.copulation_events || []) dates.push(day(event?.date));
  const known = dates.filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return known.length ? known[known.length - 1] : null;
}

/**
 * The dam's other pairings with a different male, newest first, one per
 * male. `damPlans` is every breeding plan with this dam (this one may be
 * among them). With a lay date, a pairing that started after the eggs
 * were laid is left out, and `recent` marks one within
 * SPERM_RETENTION_DAYS before the lay date.
 *
 * @returns {Array<{ sireId: string, planId: string, contactDate: string|null, recent: boolean }>}
 */
export function earlierPairings({ plan, damPlans = [], layDate = null } = {}) {
  const laid = day(layDate);
  const bySire = new Map();
  for (const other of damPlans || []) {
    if (!other || other.id === plan?.id || !other.sire_id) continue;
    if (other.sire_id === plan?.sire_id) continue;
    if (plan?.dam_id && other.dam_id && other.dam_id !== plan.dam_id) continue;
    const contactDate = lastContactDate(other);
    const startDate = day(other.pairing_date);
    if (laid && startDate && startDate > laid) continue;
    const gap = laid && contactDate ? daysBetween(contactDate, laid) : null;
    const recent = gap !== null && gap >= 0 && gap <= SPERM_RETENTION_DAYS;
    const entry = { sireId: other.sire_id, planId: other.id, contactDate, recent };
    const seen = bySire.get(other.sire_id);
    if (!seen || (contactDate || '') > (seen.contactDate || '')) bySire.set(other.sire_id, entry);
  }
  return [...bySire.values()].sort((a, b) => (b.contactDate || '').localeCompare(a.contactDate || ''));
}

/**
 * The values to store on a clutch's eggs. The plan's own sire is stored as
 * empty (the default), and a possible sire equal to the chosen sire is
 * dropped.
 */
export function clutchSireFields({ plan, sireId, possibleSireId }) {
  const sire = sireId && sireId !== plan?.sire_id ? sireId : null;
  const effective = sire || plan?.sire_id || null;
  const possible = possibleSireId && possibleSireId !== effective ? possibleSireId : null;
  return { sire_id: sire, possible_sire_id: possible };
}

/** The genetics-notes line for a hatchling whose sire is not confirmed. */
export function unconfirmedSireNote(sireName, possibleSireName) {
  const a = sireName || 'the recorded sire';
  const b = possibleSireName || 'another male';
  return `${UNCONFIRMED_SIRE_PREFIX} ${a} or ${b}. The dam was paired with both, and a female can store sperm for months.`;
}

/**
 * Genetics notes with the unconfirmed-sire line replaced: any old line is
 * removed and `line` (when given) is added at the end.
 */
export function withUnconfirmedSireNote(notes, line) {
  const kept = String(notes || '')
    .split('\n')
    .filter((l) => !l.trim().startsWith(UNCONFIRMED_SIRE_PREFIX));
  while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
  if (line) kept.push(line);
  return kept.join('\n');
}

/** True when the database does not have the egg sire columns yet. */
export function isMissingSireColumnError(error) {
  const text = `${error?.message || ''} ${error?.details || ''}`;
  return (error?.code === 'PGRST204' || error?.code === '42703') && /sire_id/.test(text);
}

export const SIRE_NOT_READY_MESSAGE =
  'Recording a different sire is still being set up. Try again in a few minutes, or save the clutch with this pairing\'s sire for now.';

/**
 * Sets the sire (and possible sire) of a whole clutch, and keeps hatched
 * eggs' geckos in step.
 *
 * Each egg of the clutch gets the new values. For an egg that already
 * hatched into a gecko, the gecko's sire moves to the new sire only when it
 * still shows the egg's old sire (a sire the member set by hand on the
 * gecko is kept), and its genetics notes get or lose the unconfirmed line.
 * A gecko the member cannot change any more (sold on) is skipped and
 * counted.
 *
 * @returns {Promise<{ eggs: number, geckos: number, skipped: number }>}
 */
export async function applyClutchSire({
  egg, plan, pairEggs = [], sireId, possibleSireId, names = {}, deps,
}) {
  const { Egg, Gecko } = deps;
  const fields = clutchSireFields({ plan, sireId, possibleSireId });
  const newSire = fields.sire_id || plan?.sire_id || null;
  const result = { eggs: 0, geckos: 0, skipped: 0 };

  for (const e of clutchEggs(egg, pairEggs)) {
    const same = (e.sire_id || null) === fields.sire_id
      && (e.possible_sire_id || null) === fields.possible_sire_id;
    const oldSire = effectiveSireId(e, plan);
    if (!same) {
      await Egg.update(e.id, fields);
      result.eggs += 1;
    }
    if (!e.gecko_id) continue;
    try {
      const gecko = await Gecko.get(e.gecko_id);
      if (!gecko) { result.skipped += 1; continue; }
      const update = {};
      if ((gecko.sire_id || null) === oldSire && oldSire !== newSire) update.sire_id = newSire;
      const line = fields.possible_sire_id
        ? unconfirmedSireNote(names[newSire], names[fields.possible_sire_id])
        : null;
      const notes = withUnconfirmedSireNote(gecko.genetics_notes, line);
      if (notes !== (gecko.genetics_notes || '')) update.genetics_notes = notes;
      if (Object.keys(update).length) {
        await Gecko.update(gecko.id, update);
        result.geckos += 1;
      }
    } catch {
      result.skipped += 1;
    }
  }
  return result;
}
