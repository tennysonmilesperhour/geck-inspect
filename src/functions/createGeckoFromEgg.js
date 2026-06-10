/**
 * Client-side hatchling creation (replaces dead Base44 backend function).
 *
 * createGeckoFromEgg({ eggId })
 *   - Looks up the egg's breeding plan and parents, generates an ID code and
 *     name from the pairing, creates the hatchling, and marks the egg Hatched.
 *   - Returns { data: { success, gecko, message } } to match the old contract.
 */
import { Egg, BreedingPlan, Gecko } from '@/entities/all';

export async function createGeckoFromEgg({ eggId } = {}) {
  if (!eggId) throw new Error('Egg ID is required');

  const egg = await Egg.get(eggId);
  if (!egg) throw new Error('Egg not found');

  const breedingPlan = await BreedingPlan.get(egg.breeding_plan_id);
  if (!breedingPlan) throw new Error('Breeding plan not found');

  const [sire, dam] = await Promise.all([
    Gecko.get(breedingPlan.sire_id),
    Gecko.get(breedingPlan.dam_id),
  ]);
  if (!sire || !dam) throw new Error('Parent geckos not found');

  const sireCode = (sire.gecko_id_code || sire.name.substring(0, 3)).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const damCode = (dam.gecko_id_code || dam.name.substring(0, 3)).toUpperCase().replace(/[^A-Z0-9]/g, '');

  const siblings = await Gecko.filter({
    sire_id: breedingPlan.sire_id,
    dam_id: breedingPlan.dam_id,
  });

  const nextId = siblings.length + 1;
  const geckoIdCode = `${sireCode}x${damCode}-${String(nextId).padStart(2, '0')}`;
  const geckoName = `${sire.name} x ${dam.name} #${nextId}`;

  const newGecko = await Gecko.create({
    name: geckoName,
    gecko_id_code: geckoIdCode,
    hatch_date: egg.hatch_date_actual || new Date().toISOString().split('T')[0],
    sex: 'Unsexed',
    sire_id: breedingPlan.sire_id,
    dam_id: breedingPlan.dam_id,
    status: 'Future Breeder',
    morphs_traits: '',
    notes: `Hatched from egg laid on ${egg.lay_date}`,
    image_urls: [],
  });

  await Egg.update(eggId, {
    gecko_id: newGecko.id,
    status: 'Hatched',
  });

  return {
    data: {
      success: true,
      gecko: newGecko,
      message: `Successfully created ${geckoName} from hatched egg`,
    },
  };
}
