import { csvEscape, splitCSVRecords, parseCSVLine, headerKey } from './morphmarketSync.js';

const yesNo = ['Yes', 'No'];
export const MORPHMARKET_FIELDS = [
  { key: 'Animal_ID', label: 'Animal ID', group: 'Listing', locked: true },
  { key: 'Category', label: 'Category', group: 'Listing', locked: true },
  { key: 'Title', label: 'Title', group: 'Listing', max: 200 },
  { key: 'State', label: 'Sale status', group: 'Listing', options: ['For Sale', 'Not For Sale', 'Sold', 'On Hold', 'Breeder', 'Holdback', 'Pet', 'For Sale (Needs Image)', 'Loaned', 'Archived', 'Deleted'] },
  { key: 'Visibility', label: 'Visibility', group: 'Listing', options: ['Public', 'Unlisted', 'Private'] },
  { key: 'Enabled', label: 'Listing activity', group: 'Listing', options: ['Active', 'Inactive', 'Expired'] },
  { key: 'Sex', label: 'Sex', group: 'Animal', options: ['Male', 'Female', 'Unsexed', 'Mixed'] },
  { key: 'DOB', label: 'Birth date', group: 'Animal', hint: 'YYYY, YYYY-MM or YYYY-MM-DD. Partial dates are kept.' },
  { key: 'Weight', label: 'Weight (whole grams)', group: 'Animal', number: true },
  { key: 'Maturity', label: 'Maturity', group: 'Animal', options: ['Baby', 'Juvenile', 'Subadult', 'Adult', 'Not Ready'] },
  { key: 'Traits', label: 'Traits', group: 'Animal', hint: 'MorphMarket trait names separated by spaces.' },
  { key: 'Origin', label: 'Origin', group: 'Animal', options: ['Self Produced', 'Captive Bred', 'Captive Hatched/Born', 'Wild Caught'] },
  { key: 'Diet', label: 'Diet', group: 'Animal', hint: 'Comma-separated MorphMarket diet names, for example Cricket, Meal Replacement.' },
  { key: 'Length', label: 'Length', group: 'Animal', number: true },
  { key: 'Length_Type', label: 'Length unit', group: 'Animal', options: ['total_length_m', 'total_length_cm', 'snout_to_vent_m', 'snout_to_vent_cm'] },
  { key: 'Proven_Breeder', label: 'Proven breeder', group: 'Animal', options: yesNo },
  { key: 'Price', label: 'Price', group: 'Sale and shipping', hint: 'Your MorphMarket Seller Profile currency. A number or inquire.' },
  { key: 'Min_Shipping', label: 'Minimum shipping price', group: 'Sale and shipping', number: true },
  { key: 'Max_Shipping', label: 'Maximum shipping price', group: 'Sale and shipping', number: true },
  { key: 'Is_Negotiable', label: 'Negotiable', group: 'Sale and shipping', options: ['Unspecified', 'Firm Price', 'Will Consider'] },
  { key: 'Is_For_Trade', label: 'Trades', group: 'Sale and shipping', options: ['Unspecified', 'Will Consider', 'No Trades'] },
  { key: "Enable 'Buy Now'", label: 'Buy Now', group: 'Sale and shipping', options: yesNo, hint: 'MorphMarket store eligibility and payment settings still apply.' },
  { key: 'Quantity', label: 'Quantity', group: 'Groups', hint: 'A whole number. Sex-count quantities require editing on MorphMarket to avoid creating extra IDs.' },
  { key: 'Group_Id', label: 'Group ID', group: 'Groups', max: 50 },
  { key: 'Is_Group', label: 'Price is for the whole group', group: 'Groups', options: yesNo },
  { key: 'Photo_Urls', label: 'Photo URLs', group: 'Photos and description', multiline: true, hint: 'Public HTTPS links separated by spaces or commas. Replacing this list replaces the photos.' },
  { key: 'Video_Url', label: 'Video URL', group: 'Photos and description', hint: 'YouTube or Vimeo URL.' },
  { key: 'Is_Rep_Photo', label: 'Representative photo', group: 'Photos and description', options: yesNo },
  { key: 'Desc', label: 'Public description', group: 'Photos and description', multiline: true, max: 3000 },
  { key: 'Wholesale_Price', label: 'Wholesale price', group: 'Private and wholesale', number: true },
  { key: 'Wholesale_Only', label: 'Wholesale only', group: 'Private and wholesale', options: yesNo },
  { key: 'Wholesale_Description', label: 'Wholesale description', group: 'Private and wholesale', multiline: true, max: 3000 },
  { key: 'Private_Notes', label: 'Private MorphMarket notes', group: 'Private and wholesale', multiline: true },
];
export const MORPHMARKET_KEYS = MORPHMARKET_FIELDS.map(f => f.key);
const readOnly = ['Last_Update', 'First_Listed', 'Last_Renewal', 'Impression_Count', 'Click_Count', 'Inquiries_Count', 'Mm_Url', 'Sires', 'Dams'];
const diet = ['Rat (Live)', 'Rat (Frozen/Thawed)', 'Rat (Pre-Killed)', 'Mouse (Live)', 'Mouse (Frozen/Thawed)', 'Mouse (Pre-Killed)', 'Soft-Furred Rat (Live)', 'Soft-Furred Rat (Frozen/Thawed)', 'Soft-Furred Rat (Pre-Killed)', 'Quail', 'Chicken', 'Rabbit', 'Cricket', 'Roach', 'Mealworm', 'Superworm', 'Hornworm', 'Waxworm', 'Fruit Fly', 'Bsfl', 'Vegetables', 'Dry Feed', 'Meal Replacement', 'Other'];

export function normalizeMorphMarketValue(key, value) {
  const text = String(value ?? '');
  const trimmed = text.trim();
  if (key === 'DOB') {
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
    const partial = /^(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (partial) return `${partial[2]}-${partial[1].padStart(2, '0')}`;
  }
  if (key === 'Length_Type') {
    const units = { 'm (total length)': 'total_length_m', 'cm (total length)': 'total_length_cm', 'm (snout to vent)': 'snout_to_vent_m', 'cm (snout to vent)': 'snout_to_vent_cm' };
    return units[trimmed.toLowerCase()] || text;
  }
  if (key === 'Diet' && trimmed) return text.split(',').map(v => diet.find(d => d.toLowerCase() === v.trim().toLowerCase()) || v.trim()).join(', ');
  if (key === 'Is_Group' && /^sold individually$/i.test(trimmed)) return 'No';
  if (key === 'Is_Group' && /^sold as (?:a )?group$/i.test(trimmed)) return 'Yes';
  const field = MORPHMARKET_FIELDS.find(f => f.key === key);
  if (field?.options === yesNo) {
    if (/^(true|t|yes|y|1)$/i.test(trimmed)) return 'Yes';
    if (/^(false|f|no|n|0)$/i.test(trimmed)) return 'No';
  }
  if (key === 'Sex') {
    if (/^m$/i.test(trimmed)) return 'Male';
    if (/^f$/i.test(trimmed)) return 'Female';
    if (/^u$/i.test(trimmed)) return 'Unsexed';
  }
  if (key === 'Maturity' && /^hatchling$/i.test(trimmed)) return 'Baby';
  if (key === 'Is_Negotiable' && /^(yes|true)$/i.test(trimmed)) return 'Will Consider';
  if (key === 'Is_Negotiable' && /^(no|false)$/i.test(trimmed)) return 'Firm Price';
  if (key === 'Is_For_Trade' && /^(yes|true)$/i.test(trimmed)) return 'Will Consider';
  if (key === 'Is_For_Trade' && /^(no|false)$/i.test(trimmed)) return 'No Trades';
  return field?.options?.find(v => v.toLowerCase() === trimmed.toLowerCase()) ?? text;
}

export function readMorphMarketSource(csv) {
  if (typeof csv !== 'string' || csv.length > 10_000_000) throw new Error('Choose a MorphMarket CSV smaller than 10 MB.');
  // An incomplete quoted record must never silently drop part of a listing.
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    if (csv[i] === '"') {
      if (quoted && csv[i + 1] === '"') i++;
      else quoted = !quoted;
    }
  }
  if (quoted) throw new Error('The CSV has an unfinished quoted cell. Export it again from MorphMarket.');
  const lines = splitCSVRecords(csv);
  const headers = parseCSVLine(lines[0] || '').map(h => h.trim().replace(/^\uFEFF/, ''));
  const keys = headers.map(headerKey);
  if (new Set(keys).size !== keys.length) throw new Error('The CSV contains duplicate column names.');
  const missing = MORPHMARKET_KEYS.filter(k => !keys.includes(headerKey(k)));
  if (missing.length) throw new Error(`Use a complete MorphMarket Animal Records export. Missing columns: ${missing.join(', ')}.`);
  const known = [...MORPHMARKET_KEYS, ...readOnly].map(headerKey);
  const unknown = headers.filter(h => !known.includes(headerKey(h)));
  if (unknown.length) throw new Error(`MorphMarket has fields we cannot preserve yet: ${unknown.join(', ')}. Export remains blocked.`);
  const rows = [];
  const ids = new Set();
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (cells.length !== headers.length) throw new Error(`Row ${i + 1} has a different number of cells than the header.`);
    const raw = Object.fromEntries(MORPHMARKET_KEYS.map(k => [k, cells[keys.indexOf(headerKey(k))]]));
    const fields = Object.fromEntries(MORPHMARKET_KEYS.map(k => [k, normalizeMorphMarketValue(k, raw[k])]));
    const id = fields.Animal_ID.trim();
    if (id && ids.has(id.toLowerCase())) throw new Error(`Duplicate MorphMarket Animal ID: ${id}. Resolve this on MorphMarket first.`);
    if (id) ids.add(id.toLowerCase());
    const extra = Object.fromEntries(headers.flatMap((h, j) => known.includes(headerKey(h)) && !MORPHMARKET_KEYS.some(k => headerKey(k) === headerKey(h)) ? [[h, cells[j]]] : []));
    rows.push({ raw, fields, extra, rowNumber: i + 1 });
  }
  if (!rows.length || rows.length > 1000) throw new Error('Choose a file with 1 to 1,000 animals.');
  return rows;
}

export function matchMorphMarketSource(rows, geckos) {
  return rows.map(row => {
    const id = row.fields.Animal_ID;
    const candidates = id ? geckos.filter(g => String(g.gecko_id_code || g.id || '') === id) : [];
    const issue = !id ? 'Set an Animal ID on MorphMarket first.'
      : row.fields.Category !== 'Crested Geckos' ? 'This workspace supports crested geckos.'
      : candidates.length > 1 ? 'More than one Geck Inspect record has this ID.'
      : candidates.length === 0 ? 'No exact Animal ID match in Geck Inspect. Import the animal or correct its ID first.' : '';
    return { ...row, gecko: candidates.length === 1 ? candidates[0] : null, issue };
  });
}

/** Keep saved explicit edits when refreshing the baseline; never apply native defaults. */
export function refreshMorphMarketDraft(source, saved) {
  const draft = { ...source };
  const conflicts = [];
  if (saved) for (const key of MORPHMARKET_KEYS) {
    if (saved.draft_fields[key] !== saved.source_fields[key]) {
      if (source[key] !== saved.source_fields[key] && source[key] !== saved.draft_fields[key]) conflicts.push(key);
      draft[key] = saved.draft_fields[key];
    }
  }
  return { draft, conflicts };
}

export function morphMarketChanges(source, draft) {
  return MORPHMARKET_FIELDS.filter(f => source[f.key] !== draft[f.key]).map(f => ({ ...f, before: source[f.key], after: draft[f.key] }));
}

export function morphMarketListingErrors(source, draft) {
  const errors = [];
  for (const f of MORPHMARKET_FIELDS) {
    const before = source?.[f.key];
    const after = draft?.[f.key];
    if (typeof before !== 'string' || typeof after !== 'string') {
      errors.push(`${f.label}: reload a complete MorphMarket export.`);
      continue;
    }
    const text = after.trim();
    if (/^[\s]*[=+\-@\t\r]/.test(after)) errors.push(`${f.label}: spreadsheet formula protection would change this value. Edit it on MorphMarket first.`);
    if (before.trim() && !text) errors.push(`${f.label}: cannot erase the existing MorphMarket value.`);
    if (f.locked && before !== after) errors.push(`${f.label}: cannot change an existing listing's identity.`);
    if (f.max && after.length > f.max) errors.push(`${f.label}: maximum ${f.max} characters.`);
    if (text && f.options && !f.options.includes(text)) errors.push(`${f.label}: select a supported value.`);
    if (text && f.number && (!/^\d+(\.\d+)?$/.test(text) || !Number.isFinite(Number(text)))) errors.push(`${f.label}: use a non-negative number.`);
  }
  for (const key of ['Animal_ID', 'Category', 'Title', 'Maturity', 'State', 'Visibility', 'Enabled', 'Sex', 'Quantity', 'Origin']) {
    if (!draft?.[key]?.trim()) errors.push(`${key}: a value is required before exporting.`);
  }
  if (draft?.Animal_ID && !/^[A-Za-z0-9\-/._]{1,100}$/.test(draft.Animal_ID)) errors.push('Animal ID: correct unsupported characters on MorphMarket first.');
  if (draft?.Category !== 'Crested Geckos') errors.push('Only Crested Geckos are supported.');
  if (draft?.Group_Id && !/^[A-Za-z0-9\-/._]{1,50}$/.test(draft.Group_Id)) errors.push('Group ID: use letters, numbers, hyphens, slashes, dots or underscores.');
  if (draft?.Quantity && !/^[1-9]\d*$/.test(draft.Quantity)) errors.push('Quantity: sex-count quantities can create extra IDs. Edit those listings on MorphMarket.');
  if (draft?.Weight && (!/^\d+$/.test(draft.Weight) || Number(draft.Weight) <= 0)) errors.push('Weight: use positive whole grams.');
  const dob = draft?.DOB;
  if (dob) {
    const full = /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : /^\d{4}-\d{2}$/.test(dob) ? `${dob}-01` : /^\d{4}$/.test(dob) ? `${dob}-01-01` : '';
    if (!full || !Number.isFinite(Date.parse(full)) || new Date(full).toISOString().slice(0, 10) !== full) errors.push('Birth date: use a real YYYY, YYYY-MM or YYYY-MM-DD date.');
  }
  if (draft?.Price && !/^inquire$/i.test(draft.Price) && (!/^\d+(\.\d+)?$/.test(draft.Price) || !Number.isFinite(Number(draft.Price)))) errors.push('Price: use a non-negative number or inquire.');
  if (['For Sale', 'Sold'].includes(draft?.State) && !(Number(draft.Price) > 0 || /^inquire$/i.test(draft.Price))) errors.push('For Sale or Sold needs a price.');
  if (Boolean(draft?.Length) !== Boolean(draft?.Length_Type)) errors.push('Length and its unit must both be filled in.');
  if (draft?.Wholesale_Only === 'Yes' && !(Number(draft.Wholesale_Price) > 0)) errors.push('Wholesale only needs a wholesale price.');
  if (draft?.Min_Shipping && draft?.Max_Shipping && Number(draft.Min_Shipping) > Number(draft.Max_Shipping)) errors.push('Maximum shipping must be at least the minimum.');
  if (draft?.Diet && draft.Diet.split(',').some(v => !diet.includes(v.trim()))) errors.push('Diet: use MorphMarket diet names from the field reference.');
  for (const key of ['Photo_Urls', 'Video_Url']) {
    const urls = key === 'Photo_Urls' ? (draft?.[key] || '').split(/[\s,]+/).filter(Boolean) : draft?.[key] ? [draft[key]] : [];
    if (urls.some(url => { try { return !['http:', 'https:'].includes(new URL(url).protocol); } catch { return true; } })) errors.push(`${key}: use public HTTP or HTTPS links.`);
  }
  return [...new Set(errors)];
}

/** Caller supplies this session's source, never just a saved draft. */
export function buildPreservedMorphMarketCSV(listings) {
  if (!listings.length) throw new Error('Select at least one matched listing.');
  if (listings.length > 1000) throw new Error('MorphMarket supports at most 1,000 rows per file.');
  const ids = new Set();
  const rows = listings.map(({ source, draft }) => {
    const errors = morphMarketListingErrors(source, draft);
    if (errors.length) throw new Error(errors.join(' '));
    const id = draft.Animal_ID.toLowerCase();
    if (ids.has(id)) throw new Error(`Duplicate Animal ID: ${draft.Animal_ID}.`);
    ids.add(id);
    return MORPHMARKET_KEYS.map(k => csvEscape(draft[k])).join(',');
  });
  return '\uFEFF' + [MORPHMARKET_KEYS.map(csvEscape).join(','), ...rows].join('\r\n');
}

export function geckoListingSuggestions(gecko) {
  const suggestions = {};
  if (gecko.asking_price != null && Number.isFinite(Number(gecko.asking_price)) && Number(gecko.asking_price) >= 0) suggestions.Price = String(gecko.asking_price);
  if (gecko.hatch_date) suggestions.DOB = gecko.hatch_date;
  if (Number(gecko.weight_grams) >= 0.5 && Number.isFinite(Number(gecko.weight_grams))) suggestions.Weight = String(Math.round(Number(gecko.weight_grams)));
  if (['Male', 'Female', 'Unsexed'].includes(gecko.sex)) suggestions.Sex = gecko.sex;
  const traits = gecko.morphs_traits || gecko.morph_tags?.join(' ');
  if (traits) suggestions.Traits = traits.replace(/[,;]+/g, ' ');
  if (gecko.marketplace_description) suggestions.Desc = gecko.marketplace_description;
  if (gecko.image_urls?.length) suggestions.Photo_Urls = gecko.image_urls.join(',');
  return suggestions;
}

// Live preservation proof: docs/planning/morphmarket-import-reference-2026-10-24.md.
export function exportPreservedMorphMarketCSV(listings, { loadedAt, reviewed } = {}) {
  if (!Number.isFinite(loadedAt) || !loadedAt || Date.now() - loadedAt > 30 * 60 * 1000 || loadedAt > Date.now()) throw new Error('Load a fresh MorphMarket CSV before exporting.');
  if (!reviewed) throw new Error('Review and confirm the listing changes before exporting.');
  return buildPreservedMorphMarketCSV(listings);
}
