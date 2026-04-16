/**
 * Client-side CSV parsing and generation utilities.
 *
 * Used by the column-mapping import flow so we can transform any
 * user-supplied spreadsheet into the template format before uploading.
 */

/**
 * Parse a CSV string into { headers: string[], rows: string[][] }.
 * Handles quoted fields, embedded commas, newlines inside quotes, and BOM.
 */
export function parseCSV(text) {
  // Strip BOM (Excel/Google Sheets often add this)
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(current.trim());
        current = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
        if (ch === '\r') i++; // skip \n after \r
      } else {
        current += ch;
      }
    }
  }

  // flush last field / row
  if (current || row.length > 0) {
    row.push(current.trim());
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0];
  const dataRows = rows.slice(1);
  return { headers, rows: dataRows };
}

/**
 * Read a File object as text using FileReader (returns a Promise).
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Escape a value for CSV output (quote if it contains comma, quote, or newline).
 */
function escapeCSVField(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Build a CSV string from the app's template headers and an array of
 * row objects keyed by template field names.
 */
export function buildCSV(headers, rowObjects) {
  const lines = [headers.map(escapeCSVField).join(',')];
  for (const obj of rowObjects) {
    const row = headers.map(h => escapeCSVField(obj[h] ?? ''));
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

/**
 * Convert a mapping + parsed rows into an array of row objects keyed by
 * the template field names.
 *
 * @param {Object<string, number|null>} mapping  – templateField → source column index (or null)
 * @param {string[]} sourceHeaders               – original CSV headers
 * @param {string[][]} sourceRows                – original CSV data rows
 * @param {string[]} templateFields              – ordered list of template field names
 * @returns {{ field: string }[]}
 */
export function transformRows(mapping, sourceHeaders, sourceRows, templateFields) {
  return sourceRows.map(srcRow => {
    const obj = {};
    for (const field of templateFields) {
      const srcIndex = mapping[field];
      if (srcIndex != null && srcIndex >= 0 && srcIndex < srcRow.length) {
        obj[field] = srcRow[srcIndex];
      } else {
        obj[field] = '';
      }
    }
    return obj;
  });
}
