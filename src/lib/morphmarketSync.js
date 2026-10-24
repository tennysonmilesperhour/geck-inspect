/**
 * MorphMarket CSV export / import utilities.
 *
 * MorphMarket's Bulk Import 2.0 accepts CSV/TSV with a header row.
 * Columns can be in any order; the live importer can clear omitted fields.
 *
 * Reference:
 *   https://support.morphmarket.com/article/123-importing-exporting-animals
 *   https://www.morphmarket.com/blog/2022/04/18/bulk-import-export-20/
 *
 * We generate a CSV file the breeder can upload directly to MorphMarket's
 * Bulk Import page. No API needed.
 */

// ─── CSV helpers ────────────────────────────────────────────────────────────

function csvEscape(value) {
  let s = value == null ? '' : String(value);
  // Quoting alone does not stop spreadsheet formula execution.
  if (/^[\s\uFEFF]*[=+@-]/.test(s) && !(typeof value === 'number' && Number.isFinite(value))) s = `'${s}`;
  if (/[",\n\r\t]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function timestampSlug() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ─── MorphMarket column spec ────────────────────────────────────────────────

/**
 * Maps MorphMarket CSV columns to Geck Inspect gecko fields.
 * `exportFn` produces the cell value from a gecko object.
 * `importKey` is the Geck Inspect field this column maps to on import.
 */
const MM_COLUMNS = [
  {
    // Bulk Import 2.0 requires an Animal ID and matches rows on it, so
    // uploading the file again updates the listings instead of adding
    // copies. MorphMarket allows letters, numbers and - / . _ (no spaces).
    header: 'Animal_ID',
    exportFn: (g) => morphMarketAnimalId(g),
    importKey: 'gecko_id_code',
  },
  {
    header: 'Title',
    exportFn: (g) => {
      // MorphMarket extracts traits from the title, so we combine
      // the morph info + gecko name for a descriptive title.
      const morphs = g.morphs_traits || (Array.isArray(g.morph_tags) ? g.morph_tags.join(' ') : '');
      const sex = g.sex === 'Male' ? 'Male' : g.sex === 'Female' ? 'Female' : '';
      return [morphs, sex, 'Crested Gecko'].filter(Boolean).join(' ').trim();
    },
    importKey: null, // Derived field, not imported directly
  },
  {
    header: 'Category',
    exportFn: () => 'Crested Geckos',
    importKey: null,
  },
  {
    header: 'Sex',
    exportFn: (g) => {
      if (g.sex === 'Male') return 'Male';
      if (g.sex === 'Female') return 'Female';
      return 'Unsexed';
    },
    importKey: 'sex',
  },
  {
    header: 'Traits',
    exportFn: (g) => (g.morphs_traits || (Array.isArray(g.morph_tags) ? g.morph_tags.join(' ') : '')).replace(/[,;]+/g, ' '),
    importKey: 'morphs_traits',
  },
  {
    header: 'Price',
    exportFn: (g) => (g.asking_price != null ? String(g.asking_price) : ''),
    importKey: 'asking_price',
  },
  {
    header: 'State',
    exportFn: (g) => {
      if (g.status === 'For Sale') return 'For Sale';
      if (g.status === 'Sold') return 'Sold';
      return 'Not For Sale';
    },
    importKey: 'status',
  },
  {
    header: 'DOB',
    exportFn: (g) => g.hatch_date || '',
    importKey: 'hatch_date',
  },
  {
    header: 'Weight',
    // MorphMarket accepts positive whole grams only.
    exportFn: (g) => Number.isFinite(Number(g.weight_grams)) && Number(g.weight_grams) >= 0.5 ? String(Math.round(Number(g.weight_grams))) : '',
    importKey: 'weight_grams',
  },
  {
    header: 'Maturity',
    exportFn: (g) => {
      if (!g.hatch_date) return '';
      const ageMonths = Math.floor(
        (Date.now() - new Date(g.hatch_date).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      );
      if (!Number.isFinite(ageMonths) || ageMonths < 0) return '';
      if (ageMonths < 3) return 'Baby';
      if (ageMonths < 8) return 'Juvenile';
      if (ageMonths < 14) return 'Subadult';
      return 'Adult';
    },
    importKey: null,
  },
  {
    header: 'Quantity',
    exportFn: () => '1',
    importKey: null,
  },
  {
    header: 'Origin',
    exportFn: () => 'Captive Bred',
    importKey: null,
  },
  {
    header: 'Desc',
    exportFn: (g) => {
      const parts = [];
      if (g.marketplace_description) parts.push(g.marketplace_description);
      else if (g.notes) parts.push(g.notes);
      if (g.gecko_id_code) parts.push(`Geck Inspect ID: ${g.gecko_id_code}`);
      return parts.join('\n');
    },
    importKey: 'marketplace_description',
  },
  {
    // Use the signed-in importer's canonical header.
    header: 'Photo_Urls',
    exportFn: (g) => (Array.isArray(g.image_urls) ? g.image_urls.join(',') : ''),
    importKey: 'image_urls',
  },
];

/**
 * The Animal ID for a gecko: its Geck Inspect ID code with anything
 * MorphMarket does not allow taken out, or the record id when it has none.
 */
export function morphMarketAnimalId(gecko) {
  const clean = (v) => String(v || '').trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9\-/._]/g, '');
  return clean(gecko.gecko_id_code) || clean(gecko.id);
}

// ─── Export ─────────────────────────────────────────────────────────────────

export const MORPHMARKET_EXPORT_BLOCKED_REASON = 'MorphMarket export is paused because uploads can erase existing listing details, even when columns are omitted. Export will return after we can preserve those details.';

/**
 * Export an array of gecko objects as a MorphMarket-compatible CSV and
 * trigger a browser download.
 *
 * @param {Array} geckos gecko records from Supabase
 * @param {{ filename?: string }} options
 * @returns {string} the filename used
 */
export function exportMorphMarketCSV(geckos, { filename } = {}) {
  const csv = buildMorphMarketCSV(geckos);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const name = filename || `morphmarket-export-${timestampSlug()}.csv`;
  downloadBlob(blob, name);
  return name;
}

/** Block both download and clipboard callers until preservation is proven. */
export function buildMorphMarketCSV() {
  throw new Error(MORPHMARKET_EXPORT_BLOCKED_REASON);
}

/** Pure formatter for regression checks, not a production export entry point. */
export function formatMorphMarketCSV(geckos) {
  const headers = morphMarketHeaders(geckos);
  const header = headers.map(csvEscape).join(',');
  const rows = geckos.map((g) => {
    const row = buildMorphMarketRow(g);
    return headers.map((h) => csvEscape(row[h])).join(',');
  });
  return '\uFEFF' + [header, ...rows].join('\r\n');
}

/**
 * All supported export headers. Use morphMarketHeaders for a batch's
 * actual columns, which omit optional fields with no values.
 */
export const MM_HEADERS = MM_COLUMNS.map((c) => c.header);

/** Omit empty optional columns for readability; MorphMarket can still clear those fields. */
export function morphMarketHeaders(geckos) {
  const optional = new Set(['Price', 'DOB', 'Weight', 'Traits', 'Desc', 'Photo_Urls']);
  return MM_COLUMNS.filter((c) => !optional.has(c.header) || geckos.some((g) => c.exportFn(g) !== ''))
    .map((c) => c.header);
}

/**
 * Build a single MorphMarket row as a plain object keyed by column
 * header. Lets the UI render the same values that end up in the CSV
 * without re-implementing the export logic.
 */
export function buildMorphMarketRow(gecko) {
  const row = {};
  for (const c of MM_COLUMNS) row[c.header] = c.exportFn(gecko);
  return row;
}

// ─── Import (parse) ─────────────────────────────────────────────────────────

/**
 * Parse a MorphMarket CSV export into Geck Inspect gecko records.
 * Returns an array of partial gecko objects ready to create/update.
 *
 * @param {string} csvText raw CSV file content
 * @returns {{ records: Array, warnings: string[] }}
 */
export function parseMorphMarketCSV(csvText) {
  const warnings = [];

  // Split into records respecting quoted fields that may contain
  // newlines. We walk character-by-character tracking quote state
  // instead of splitting on \n which breaks multiline descriptions.
  const records_raw = splitCSVRecords(csvText);
  if (records_raw.length < 2) {
    warnings.push('File appears empty or has only a header row.');
    return { records: [], warnings };
  }

  // Parse header
  const headerLine = records_raw[0];
  const headers = parseCSVLine(headerLine).map((h) => h.trim());

  // Build column index map
  const colIndex = {};
  headers.forEach((h, i) => {
    colIndex[headerKey(h)] = i;
  });

  const records = [];
  for (let i = 1; i < records_raw.length; i++) {
    const fields = parseCSVLine(records_raw[i]);
    if (fields.length === 0) continue;

    // MorphMarket's own export and older files spell some headers
    // differently ("Photo Urls", "Birth Date", "Animal Id"), so each field
    // takes the first of its names present. Case, spaces and underscores
    // do not matter.
    const get = (...names) => {
      for (const name of names) {
        const idx = colIndex[headerKey(name)];
        if (idx != null) return (fields[idx] || '').trim();
      }
      return '';
    };

    const category = get('Category');
    if (category && !/^crested geckos?$/i.test(category)) {
      warnings.push(`Row ${i + 1}: skipped ${category}. This importer is for crested geckos.`);
      continue;
    }

    const record = {};

    const animalId = get('Animal_ID', 'Animal ID', 'AnimalID');
    if (animalId) record.gecko_id_code = animalId;
    else warnings.push(`Row ${i + 1}: no Animal_ID. Importing this row again can create a duplicate. Assign an ID on MorphMarket before exporting if you need repeat imports.`);

    // Name: derive from Title or Traits
    const title = get('Title');
    const traits = get('Traits');
    record.name = title || traits || `Import ${i}`;
    record.morphs_traits = traits || title || '';

    // Sex
    const sex = get('Sex');
    if (/^(male|m)$/i.test(sex)) record.sex = 'Male';
    else if (/^(female|f)$/i.test(sex)) record.sex = 'Female';
    else record.sex = 'Unsexed'; // the app's value for unsexed geckos (was 'Unknown', which no sex filter matched)

    // Price
    const price = get('Price');
    if (price) {
      const num = parseFloat(price.replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) record.asking_price = num;
    }

    // Status
    const status = get('State', 'Status');
    record.is_public = false;
    if (/^for sale(?: \(needs image\))?$/i.test(status)) {
      record.status = 'For Sale';
      record.is_public = !/^(private|unlisted)$/i.test(get('Visibility')) && !/^(inactive|expired)$/i.test(get('Enabled'));
    } else if (/^sold$/i.test(status)) {
      record.status = 'Sold';
    } else {
      record.status = 'Pet';
    }

    // DOB / hatch date
    const sourceDob = get('DOB', 'Birth Date', 'Birthdate', 'Hatch Date');
    // MorphMarket's export uses M/D/YYYY even though its importer accepts ISO.
    const usDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(sourceDob);
    const dob = usDate ? `${usDate[3]}-${usDate[1].padStart(2, '0')}-${usDate[2].padStart(2, '0')}` : sourceDob;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dob) && !Number.isNaN(Date.parse(dob)) && new Date(dob).toISOString().slice(0, 10) === dob) record.hatch_date = dob;
    else if (dob) warnings.push(`Row ${i + 1}: birth date "${sourceDob}" was not imported. Geck Inspect needs a complete YYYY-MM-DD date.`);

    // Weight
    const weight = get('Weight');
    if (weight) {
      const num = parseFloat(weight);
      if (!isNaN(num)) record.weight_grams = num;
    }

    // Description
    const desc = get('Description', 'Desc');
    if (desc) record.notes = desc;

    // Images
    const images = get('Images', 'Photo URLs', 'Photos');
    if (images) {
      record.image_urls = images.split(/[\s,]+/).map((u) => u.trim()).filter(Boolean);
    }

    records.push(record);
  }

  if (records.length === 0) {
    warnings.push('No valid records found in the CSV.');
  }

  return { records, warnings };
}

function headerKey(name) {
  return String(name).replace(/^\uFEFF/, '').toLowerCase().replace(/\*+$/, '').replace(/[\s_]+/g, '');
}

/**
 * Split raw CSV text into record strings, correctly handling newlines
 * inside quoted fields (e.g. multiline MorphMarket descriptions).
 */
function splitCSVRecords(text) {
  const records = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '""';
          i++;
        } else {
          inQuotes = false;
          current += ch;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        current += ch;
      } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        if (ch === '\r') i++; // skip the \n in \r\n
        if (current.trim()) records.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  if (current.trim()) records.push(current);
  return records;
}

/**
 * Simple CSV line parser that handles quoted fields with commas and
 * escaped quotes inside them.
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}
