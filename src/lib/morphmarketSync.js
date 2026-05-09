/**
 * MorphMarket CSV export / import utilities.
 *
 * MorphMarket's Bulk Import 2.0 accepts CSV/TSV with a header row.
 * Columns can be in any order; only included columns are processed.
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
  const s = value == null ? '' : String(value);
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
    exportFn: (g) => g.morphs_traits || (Array.isArray(g.morph_tags) ? g.morph_tags.join(', ') : ''),
    importKey: 'morphs_traits',
  },
  {
    header: 'Price',
    exportFn: (g) => (g.asking_price != null ? String(g.asking_price) : ''),
    importKey: 'asking_price',
  },
  {
    header: 'Currency',
    exportFn: () => 'USD',
    importKey: null,
  },
  {
    header: 'Status',
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
    exportFn: (g) => (g.weight_grams != null ? String(g.weight_grams) : ''),
    importKey: 'weight_grams',
  },
  {
    header: 'Maturity',
    exportFn: (g) => {
      if (!g.hatch_date) return '';
      const ageMonths = Math.floor(
        (Date.now() - new Date(g.hatch_date).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      );
      if (ageMonths < 3) return 'Baby';
      if (ageMonths < 8) return 'Juvenile';
      if (ageMonths < 14) return 'Sub-Adult';
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
    header: 'Description',
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
    header: 'Images',
    exportFn: (g) => (Array.isArray(g.image_urls) ? g.image_urls.join(',') : ''),
    importKey: 'image_urls',
  },
];

// ─── Export ─────────────────────────────────────────────────────────────────

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

/**
 * Build the MorphMarket CSV text for the given geckos. Exposed so the
 * batch builder can preview the file in the UI and copy it to the
 * clipboard without forcing a download. Includes a UTF-8 BOM so Excel
 * opens it cleanly.
 */
export function buildMorphMarketCSV(geckos) {
  const header = MM_COLUMNS.map((c) => csvEscape(c.header)).join(',');
  const rows = geckos.map((g) =>
    MM_COLUMNS.map((c) => csvEscape(c.exportFn(g))).join(',')
  );
  return '\uFEFF' + [header, ...rows].join('\r\n');
}

/**
 * The MorphMarket column headers, in the order they're written to the
 * CSV. Used by the batch builder's preview table so the on-screen
 * layout matches the file the breeder downloads.
 */
export const MM_HEADERS = MM_COLUMNS.map((c) => c.header);

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
    colIndex[h.toLowerCase()] = i;
  });

  const records = [];
  for (let i = 1; i < records_raw.length; i++) {
    const fields = parseCSVLine(records_raw[i]);
    if (fields.length === 0) continue;

    const get = (name) => {
      const idx = colIndex[name.toLowerCase()];
      return idx != null ? (fields[idx] || '').trim() : '';
    };

    const record = {};

    // Name: derive from Title or Traits
    const title = get('Title');
    const traits = get('Traits');
    record.name = title || traits || `Import ${i}`;
    record.morphs_traits = traits || title || '';

    // Sex
    const sex = get('Sex');
    if (/male/i.test(sex) && !/female/i.test(sex)) record.sex = 'Male';
    else if (/female/i.test(sex)) record.sex = 'Female';
    else record.sex = 'Unknown';

    // Price
    const price = get('Price');
    if (price) {
      const num = parseFloat(price.replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) record.asking_price = num;
    }

    // Status
    const status = get('Status');
    if (/for sale/i.test(status)) {
      record.status = 'For Sale';
      record.is_public = true;
    } else if (/sold/i.test(status)) {
      record.status = 'Sold';
    } else {
      record.status = 'Pet';
    }

    // DOB / hatch date
    const dob = get('DOB');
    if (dob) record.hatch_date = dob;

    // Weight
    const weight = get('Weight');
    if (weight) {
      const num = parseFloat(weight);
      if (!isNaN(num)) record.weight_grams = num;
    }

    // Description
    const desc = get('Description');
    if (desc) record.notes = desc;

    // Images
    const images = get('Images');
    if (images) {
      record.image_urls = images.split(',').map((u) => u.trim()).filter(Boolean);
    }

    records.push(record);
  }

  if (records.length === 0) {
    warnings.push('No valid records found in the CSV.');
  }

  return { records, warnings };
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
