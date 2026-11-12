/**
 * What a spreadsheet import will do under the plan's gecko limit, worked
 * out before anything is saved (experience review, finding J4). The
 * import used to say "rows were skipped" only after it had finished.
 *
 * This walks the rows the way src/functions/importGeckosFromCSV.js does,
 * so the numbers shown before the import match what it then does:
 *   - a row with no name is skipped;
 *   - a row whose ID code matches a gecko the member already has is an
 *     update (or is skipped in "create new only" mode) and uses no slot;
 *   - every other row is a new gecko and uses one slot. Archived geckos
 *     do not count toward the limit, the same as everywhere else.
 */

const codeOf = (value) => String(value || '').trim().toLowerCase();

/**
 * @param {Object} options
 * @param {Object[]} options.rows rows keyed by template field (transformRows)
 * @param {Object[]} options.existingGeckos the member's own geckos, archived ones included
 * @param {number} options.limit the plan's active gecko limit, Infinity for none
 * @param {string} options.importMode 'create_and_update' or 'create_only'
 * @param {boolean} options.nameMapped false while the Name column is not
 *   mapped yet: names cannot be read, so every row counts as a new gecko
 *   (the most the file could add)
 */
export function previewImport({
  rows = [],
  existingGeckos = [],
  limit = Infinity,
  importMode = 'create_and_update',
  nameMapped = true,
}) {
  const limited = Number.isFinite(limit);
  const active = existingGeckos.filter((g) => g && !g.archived).length;
  const codes = new Set(existingGeckos.map((g) => codeOf(g?.gecko_id_code)).filter(Boolean));
  let slotsLeft = limited ? Math.max(0, limit - active) : Infinity;
  let newRows = 0;
  let willAdd = 0;
  let updates = 0;

  for (const row of rows) {
    if (nameMapped && !String(row?.name || '').trim()) continue;
    const code = codeOf(row?.gecko_id_code);
    if (code && codes.has(code)) {
      if (importMode !== 'create_only') updates += 1;
      continue;
    }
    newRows += 1;
    if (slotsLeft <= 0) continue;
    willAdd += 1;
    slotsLeft -= 1;
    if (code) codes.add(code);
  }

  return {
    limited,
    limit,
    active,
    total: rows.length,
    newRows,
    willAdd,
    updates,
    // New geckos the limit keeps out.
    held: newRows - willAdd,
    // Rows the import will write: new geckos plus updates.
    willImport: willAdd + updates,
  };
}

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The sentence shown at the mapping step, or null when the limit does not
 * get in the way (unlimited plans, or a file that fits).
 * "Your plan holds 10 geckos and you have 6. This file has 34 rows: the
 * first 4 will be imported."
 */
export function importLimitNotice(preview) {
  if (!preview || !preview.limited || preview.held <= 0) return null;
  const { limit, active, total, newRows, willAdd, updates } = preview;
  const plan = `Your plan holds ${count(limit, 'gecko')} and you have ${active}.`;

  // The plain case: every row is a new gecko.
  if (newRows === total) {
    const outcome = willAdd === 0
      ? 'none of them can be imported'
      : willAdd === 1
        ? 'only the first will be imported'
        : `the first ${willAdd} will be imported`;
    return `${plan} This file has ${count(total, 'row')}: ${outcome}.`;
  }

  const added = willAdd === 0
    ? (newRows === 1 ? 'it cannot be added' : 'none of the new ones can be added')
    : willAdd === 1
      ? 'only the first new one will be added'
      : `the first ${willAdd} new ones will be added`;
  const updated = updates > 0
    ? `, and the ${updates} that ${updates === 1 ? 'matches a gecko' : 'match geckos'} you already have will be updated`
    : '';
  const fresh = newRows === 1 ? '1 of them a new gecko' : `${newRows} of them new geckos`;
  return `${plan} This file has ${count(total, 'row')}, ${fresh}: ${added}${updated}.`;
}
