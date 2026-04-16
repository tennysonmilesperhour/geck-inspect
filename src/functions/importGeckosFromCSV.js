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
import { Gecko } from '@/entities/all';

const VALID_SEX = ['Male', 'Female', 'Unsexed'];
const VALID_STATUS = ['Pet', 'Future Breeder', 'Holdback', 'Ready to Breed', 'Proven', 'For Sale', 'Sold'];

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

  // MM/DD/YYYY or DD/MM/YYYY — try US format first
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
 * @param {Object[]} rows — array of row objects keyed by template field names
 * @param {Object} options
 * @param {string} options.importMode — 'create_and_update' or 'create_only'
 * @returns {{ success: boolean, results: { processed, created, updated, errors, warnings } }}
 */
export async function importGeckosFromCSV({ rows, importMode = 'create_and_update' }) {
  const results = {
    processed: 0,
    created: 0,
    updated: 0,
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

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowLabel = `Row ${i + 1}`;
    results.processed++;

    try {
      const name = (row.name || '').trim();
      if (!name) {
        results.warnings.push(`${rowLabel}: Skipped — no name provided.`);
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
        results.warnings.push(`${rowLabel}: "${name}" (${geckoIdCode}) already exists — skipped.`);
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
          results.warnings.push(`${rowLabel}: Sire ID code "${sireIdCode}" not found — stored as sire name.`);
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
          results.warnings.push(`${rowLabel}: Dam ID code "${damIdCode}" not found — stored as dam name.`);
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

      if (existing) {
        // Update existing
        await Gecko.update(existing.id, cleanData);
        results.updated++;
        // Update local map in case later rows reference this gecko
        const updated = { ...existing, ...cleanData };
        if (geckoIdCode) byIdCode.set(geckoIdCode.toLowerCase(), updated);
        byId.set(existing.id, updated);
      } else {
        // Create new
        const created = await Gecko.create(cleanData);
        results.created++;
        // Add to local maps for lineage resolution of later rows
        if (created.gecko_id_code) {
          byIdCode.set(created.gecko_id_code.toLowerCase(), created);
        }
        if (created.id) byId.set(created.id, created);
      }
    } catch (err) {
      results.errors.push(`${rowLabel}: ${err.message}`);
    }
  }

  const success = results.errors.length === 0;
  return { success, data: { success, results } };
}
