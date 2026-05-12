/**
 * Client-side gecko CSV import (replaces dead Base44 backend function).
 *
 * Accepts an array of row objects (already mapped to template field keys)
 * and creates/updates geckos directly in Supabase.
 *
 * Two import modes:
 *   - create_and_update: match by gecko_id_code, update if exists, create if not
 *   - create_only: skip rows whose gecko_id_code already exists
 */
import { Gecko, BreedingPlan, Egg } from '@/entities/all';
import { GECKO_STATUS_OPTIONS, GECKO_SEX_OPTIONS } from '@/lib/constants';

const VALID_SEX = GECKO_SEX_OPTIONS;
const VALID_STATUS = GECKO_STATUS_OPTIONS;
const VALID_EGG_STATUS = ['Incubating', 'Hatched', 'Slug', 'Infertile', 'Stillbirth'];

function normaliseEggStatus(raw, hasHatchedGecko) {
  if (!raw) return hasHatchedGecko ? 'Hatched' : 'Incubating';
  const lower = String(raw).trim().toLowerCase();
  const match = VALID_EGG_STATUS.find(s => s.toLowerCase() === lower);
  if (match) return match;
  if (lower === 'hatch' || lower === 'hatched out') return 'Hatched';
  if (lower === 'incubating' || lower === 'incubation' || lower === 'in incubation') return 'Incubating';
  if (lower === 'dud' || lower === 'slug') return 'Slug';
  if (lower === 'infertile' || lower === 'unfertile') return 'Infertile';
  if (lower === 'stillborn' || lower === 'stillbirth' || lower === 'died') return 'Stillbirth';
  return hasHatchedGecko ? 'Hatched' : 'Incubating';
}

/**
 * Normalise a sex value from common CSV variants.
 */
function normaliseSex(raw) {
  if (!raw) return 'Unsexed';
  const lower = raw.trim().toLowerCase();
  if (lower === 'm' || lower === 'male') return 'Male';
  if (lower === 'f' || lower === 'female') return 'Female';
  if (lower === 'u' || lower === 'unsexed' || lower === 'unknown') return 'Unsexed';
  // Check if it's already a valid value
  const match = VALID_SEX.find(s => s.toLowerCase() === lower);
  return match || 'Unsexed';
}

/**
 * Normalise a status value from common CSV variants.
 */
function normaliseStatus(raw) {
  if (!raw) return 'Pet';
  const lower = raw.trim().toLowerCase();
  const match = VALID_STATUS.find(s => s.toLowerCase() === lower);
  if (match) return match;
  // Common aliases
  if (lower === 'breeder' || lower === 'breeding') return 'Ready to Breed';
  if (lower === 'hold' || lower === 'holdback' || lower === 'hold back') return 'Holdback';
  if (lower === 'sale' || lower === 'available' || lower === 'for sale') return 'For Sale';
  if (lower === 'sold') return 'Sold';
  if (lower === 'proven') return 'Proven';
  if (lower === 'future breeder') return 'Future Breeder';
  return 'Pet';
}

/**
 * Try to parse a date string into YYYY-MM-DD format.
 */
function parseDate(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Try native Date parsing
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // MM/DD/YYYY or DD/MM/YYYY ,  try US format first
  const slashMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slashMatch) {
    let [, a, b, y] = slashMatch;
    if (y.length === 2) y = '20' + y;
    // Assume MM/DD/YYYY (US format)
    const month = parseInt(a, 10);
    const day = parseInt(b, 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Parse a numeric value, stripping currency symbols and commas.
 */
function parseNumber(raw) {
  if (raw == null || raw === '') return null;
  const cleaned = String(raw).replace(/[$£€,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parse morph_tags from a string (comma or pipe separated).
 */
function parseMorphTags(raw) {
  if (!raw) return [];
  return raw
    .split(/[,|;]+/)
    .map(t => t.trim())
    .filter(Boolean);
}

/**
 * Main import function.
 *
 * @param {Object[]} rows ,  array of row objects keyed by template field names
 * @param {Object} options
 * @param {string}  options.importMode ,  'create_and_update' or 'create_only'
 * @param {boolean} options.createBreedingPairs ,  upsert BreedingPlan for each (sire, dam) pair resolved from rows
 * @param {boolean} options.importEggs ,  create Egg records from rows that have egg_lay_date + a resolved pair
 * @returns {{ success: boolean, results: { processed, created, updated, pairsCreated, eggsCreated, errors, warnings } }}
 */
export async function importGeckosFromCSV({
  rows,
  importMode = 'create_and_update',
  createBreedingPairs = false,
  importEggs = false,
}) {
  const results = {
    processed: 0,
    created: 0,
    updated: 0,
    pairsCreated: 0,
    eggsCreated: 0,
    errors: [],
    warnings: [],
  };

  if (!rows || rows.length === 0) {
    results.errors.push('No data rows to import.');
    return { success: false, data: { success: false, results } };
  }

  // Fetch all existing geckos for matching
  let existingGeckos = [];
  try {
    existingGeckos = await Gecko.filter({});
  } catch (err) {
    results.errors.push('Failed to load existing geckos: ' + err.message);
    return { success: false, data: { success: false, results } };
  }

  // Build lookup maps
  const byIdCode = new Map();
  const byId = new Map();
  for (const g of existingGeckos) {
    if (g.gecko_id_code) byIdCode.set(g.gecko_id_code.toLowerCase().trim(), g);
    if (g.id) byId.set(g.id, g);
  }

  // Per-row breeding context captured during the gecko pass, consumed by the
  // pair/egg passes that run after all geckos have been upserted.
  const rowBreedingInfo = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowLabel = `Row ${i + 1}`;
    results.processed++;

    try {
      const name = (row.name || '').trim();
      if (!name) {
        results.warnings.push(`${rowLabel}: Skipped ,  no name provided.`);
        continue;
      }

      const sex = normaliseSex(row.sex);
      const geckoIdCode = (row.gecko_id_code || '').trim();

      // Check if gecko already exists (by id code)
      let existing = null;
      if (geckoIdCode) {
        existing = byIdCode.get(geckoIdCode.toLowerCase());
      }

      if (existing && importMode === 'create_only') {
        results.warnings.push(`${rowLabel}: "${name}" (${geckoIdCode}) already exists ,  skipped.`);
        continue;
      }

      // Resolve sire
      let sireId = null;
      let sireName = (row.sire_name || '').trim();
      const sireIdCode = (row.sire_id_code || '').trim();
      if (sireIdCode) {
        const sire = byIdCode.get(sireIdCode.toLowerCase());
        if (sire) {
          sireId = sire.id;
          if (!sireName) sireName = sire.name;
        } else {
          results.warnings.push(`${rowLabel}: Sire ID code "${sireIdCode}" not found ,  stored as sire name.`);
          if (!sireName) sireName = sireIdCode;
        }
      }

      // Resolve dam
      let damId = null;
      let damName = (row.dam_name || '').trim();
      const damIdCode = (row.dam_id_code || '').trim();
      if (damIdCode) {
        const dam = byIdCode.get(damIdCode.toLowerCase());
        if (dam) {
          damId = dam.id;
          if (!damName) damName = dam.name;
        } else {
          results.warnings.push(`${rowLabel}: Dam ID code "${damIdCode}" not found ,  stored as dam name.`);
          if (!damName) damName = damIdCode;
        }
      }

      const geckoData = {
        name,
        sex,
        gecko_id_code: geckoIdCode || undefined,
        species: (row.species || '').trim() || 'Crested Gecko',
        hatch_date: parseDate(row.hatch_date),
        status: normaliseStatus(row.status),
        morphs_traits: (row.morphs_traits || '').trim() || undefined,
        morph_tags: parseMorphTags(row.morph_tags),
        sire_id: sireId || undefined,
        sire_name: sireName || undefined,
        dam_id: damId || undefined,
        dam_name: damName || undefined,
        weight_grams: parseNumber(row.weight_grams),
        asking_price: parseNumber(row.asking_price),
        notes: (row.notes || '').trim() || undefined,
        breeder_name: (row.breeder_name || '').trim() || undefined,
        genetics_notes: (row.genetics_notes || '').trim() || undefined,
        estimated_hatch_year: row.estimated_hatch_year
          ? parseInt(row.estimated_hatch_year, 10) || undefined
          : undefined,
      };

      // Strip undefined values
      const cleanData = Object.fromEntries(
        Object.entries(geckoData).filter(([, v]) => v !== undefined)
      );

      let geckoRecord;
      if (existing) {
        // Update existing
        await Gecko.update(existing.id, cleanData);
        results.updated++;
        geckoRecord = { ...existing, ...cleanData };
        if (geckoIdCode) byIdCode.set(geckoIdCode.toLowerCase(), geckoRecord);
        byId.set(existing.id, geckoRecord);
      } else {
        // Create new
        geckoRecord = await Gecko.create(cleanData);
        results.created++;
        if (geckoRecord.gecko_id_code) {
          byIdCode.set(geckoRecord.gecko_id_code.toLowerCase(), geckoRecord);
        }
        if (geckoRecord.id) byId.set(geckoRecord.id, geckoRecord);
      }

      // Stash breeding info for the post-passes if the row had any useful bits.
      if (sireId && damId) {
        rowBreedingInfo.push({
          rowLabel,
          geckoId: geckoRecord.id,
          geckoHatchDate: geckoRecord.hatch_date || null,
          sireId,
          damId,
          pairingDate: parseDate(row.pairing_date),
          breedingSeason: (row.breeding_season || '').trim() || null,
          eggLayDate: parseDate(row.egg_lay_date),
          eggStatusRaw: row.egg_status,
          clutchNumber: (row.clutch_number || '').toString().trim() || null,
        });
      } else if ((importEggs || createBreedingPairs) && (row.egg_lay_date || row.pairing_date)) {
        results.warnings.push(
          `${rowLabel}: breeding/egg columns were provided but sire and dam could not both be resolved ,  skipping pair/egg creation for this row.`
        );
      }
    } catch (err) {
      results.errors.push(`${rowLabel}: ${err.message}`);
    }
  }

  // --- Pass 2: upsert breeding pairs (BreedingPlan) ---------------------------
  // Key each unique pair by "sire_id::dam_id" to dedupe across rows. If a plan
  // already exists in the DB for that pair, reuse it; otherwise create one.
  const planByPairKey = new Map();
  if (createBreedingPairs || importEggs) {
    let existingPlans = [];
    try {
      existingPlans = await BreedingPlan.filter({});
    } catch (err) {
      results.warnings.push('Could not load existing breeding plans: ' + err.message);
    }
    for (const p of existingPlans) {
      if (p.sire_id && p.dam_id) {
        planByPairKey.set(`${p.sire_id}::${p.dam_id}`, p);
      }
    }

    if (createBreedingPairs) {
      const seenNew = new Set();
      for (const info of rowBreedingInfo) {
        const key = `${info.sireId}::${info.damId}`;
        if (planByPairKey.has(key) || seenNew.has(key)) continue;
        seenNew.add(key);
        try {
          const plan = await BreedingPlan.create({
            sire_id: info.sireId,
            dam_id: info.damId,
            pairing_date: info.pairingDate || undefined,
            breeding_season: info.breedingSeason || undefined,
            status: 'Planned',
          });
          planByPairKey.set(key, plan);
          results.pairsCreated++;
        } catch (err) {
          results.warnings.push(`${info.rowLabel}: could not create breeding pair ,  ${err.message}`);
        }
      }
    }
  }

  // --- Pass 3: create egg records --------------------------------------------
  // Only for rows that have an egg_lay_date and resolved to a breeding plan
  // (either pre-existing or freshly created). Skip if an egg already links to
  // the same gecko, to keep re-imports idempotent.
  if (importEggs) {
    let existingEggs = [];
    try {
      existingEggs = await Egg.filter({});
    } catch (err) {
      results.warnings.push('Could not load existing eggs: ' + err.message);
    }
    const eggByGeckoId = new Map();
    for (const e of existingEggs) {
      if (e.gecko_id) eggByGeckoId.set(e.gecko_id, e);
    }

    for (const info of rowBreedingInfo) {
      if (!info.eggLayDate) continue;
      const key = `${info.sireId}::${info.damId}`;
      const plan = planByPairKey.get(key);
      if (!plan) {
        results.warnings.push(
          `${info.rowLabel}: egg has a lay date but no breeding pair ,  enable "Auto-create breeding pairs" or pre-create the pair.`
        );
        continue;
      }
      if (eggByGeckoId.has(info.geckoId)) continue; // idempotent re-import

      try {
        const egg = await Egg.create({
          breeding_plan_id: plan.id,
          lay_date: info.eggLayDate,
          status: normaliseEggStatus(info.eggStatusRaw, !!info.geckoHatchDate),
          hatch_date_actual: info.geckoHatchDate || undefined,
          gecko_id: info.geckoId || undefined,
          clutch_number: info.clutchNumber || undefined,
        });
        eggByGeckoId.set(info.geckoId, egg);
        results.eggsCreated++;
      } catch (err) {
        results.warnings.push(`${info.rowLabel}: could not create egg ,  ${err.message}`);
      }
    }
  }

  const success = results.errors.length === 0;
  return { success, data: { success, results } };
}
