/**
 * Smart auto-mapping for CSV column headers → Geck Inspect template fields.
 *
 * Maps common spreadsheet naming conventions (MorphMarket exports,
 * Gecko Breeder exports, custom spreadsheets, etc.) to our internal fields.
 */

/**
 * The canonical template fields in display order.
 * These are the column names the backend importGeckosFromCSV expects.
 */
export const TEMPLATE_FIELDS = [
  { key: 'name',            label: 'Name',            required: true  },
  { key: 'gecko_id_code',   label: 'ID Code',         required: false },
  { key: 'sex',             label: 'Sex',             required: true  },
  { key: 'species',         label: 'Species',         required: false },
  { key: 'hatch_date',      label: 'Hatch Date',      required: false },
  { key: 'status',          label: 'Status',          required: false },
  { key: 'morphs_traits',   label: 'Morphs / Traits', required: false },
  { key: 'morph_tags',      label: 'Morph Tags',      required: false },
  { key: 'sire_id_code',    label: 'Sire ID Code',    required: false },
  { key: 'sire_name',       label: 'Sire Name',       required: false },
  { key: 'dam_id_code',     label: 'Dam ID Code',     required: false },
  { key: 'dam_name',        label: 'Dam Name',        required: false },
  { key: 'weight_grams',    label: 'Weight (g)',       required: false },
  { key: 'asking_price',    label: 'Asking Price',    required: false },
  { key: 'notes',           label: 'Notes',           required: false },
  { key: 'breeder_name',    label: 'Breeder Name',    required: false },
  { key: 'genetics_notes',  label: 'Genetics Notes',  required: false },
  { key: 'estimated_hatch_year', label: 'Estimated Hatch Year', required: false },

  // --- Breeding / egg columns (used only when the corresponding import option is on) ---
  { key: 'pairing_date',    label: 'Pairing Date',    required: false, group: 'breeding' },
  { key: 'breeding_season', label: 'Breeding Season', required: false, group: 'breeding' },
  { key: 'egg_lay_date',    label: 'Egg Lay Date',    required: false, group: 'eggs' },
  { key: 'egg_status',      label: 'Egg Status',      required: false, group: 'eggs' },
  { key: 'clutch_number',   label: 'Clutch Number',   required: false, group: 'eggs' },
];

/**
 * Alias map: normalised alias → template field key.
 *
 * Each alias is lowercased and stripped of special chars for matching.
 * Order matters ,  first match wins, so put more specific aliases first.
 */
const ALIAS_MAP = [
  // Name
  ['name',              'name'],
  ['gecko name',        'name'],
  ['animal name',       'name'],
  ['animal',            'name'],
  ['pet name',          'name'],
  ['title',             'name'],

  // ID Code
  ['gecko id code',     'gecko_id_code'],
  ['id code',           'gecko_id_code'],
  ['gecko id',          'gecko_id_code'],
  ['animal id',         'gecko_id_code'],
  ['id',                'gecko_id_code'],
  ['code',              'gecko_id_code'],
  ['identifier',        'gecko_id_code'],
  ['tag',               'gecko_id_code'],
  ['tag number',        'gecko_id_code'],
  ['microchip',         'gecko_id_code'],

  // Sex
  ['sex',               'sex'],
  ['gender',            'sex'],

  // Species
  ['species',           'species'],
  ['type',              'species'],
  ['gecko type',        'species'],
  ['animal type',       'species'],
  ['breed',             'species'],

  // Hatch date
  ['hatch date',        'hatch_date'],
  ['hatchdate',         'hatch_date'],
  ['hatched',           'hatch_date'],
  ['date of birth',     'hatch_date'],
  ['dob',               'hatch_date'],
  ['birthday',          'hatch_date'],
  ['birth date',        'hatch_date'],
  ['birthdate',         'hatch_date'],
  ['born',              'hatch_date'],
  ['date hatched',      'hatch_date'],
  ['hatch',             'hatch_date'],

  // Status
  ['status',            'status'],
  ['category',          'status'],
  ['availability',      'status'],
  ['available',         'status'],
  ['listing status',    'status'],

  // Morphs / Traits
  ['morphs traits',     'morphs_traits'],
  ['morphs / traits',   'morphs_traits'],
  ['morphs/traits',     'morphs_traits'],
  ['morph',             'morphs_traits'],
  ['morphs',            'morphs_traits'],
  ['traits',            'morphs_traits'],
  ['trait',             'morphs_traits'],
  ['color',             'morphs_traits'],
  ['color morph',       'morphs_traits'],
  ['pattern',           'morphs_traits'],
  ['genetics',          'morphs_traits'],
  ['gene',              'morphs_traits'],
  ['genes',             'morphs_traits'],
  ['phenotype',         'morphs_traits'],
  ['visual',            'morphs_traits'],
  ['appearance',        'morphs_traits'],
  ['description',       'morphs_traits'],

  // Morph tags (pipe or comma separated)
  ['morph tags',        'morph_tags'],
  ['morph tag',         'morph_tags'],
  ['tags',              'morph_tags'],

  // Sire
  ['sire id code',      'sire_id_code'],
  ['sire id',           'sire_id_code'],
  ['sire code',         'sire_id_code'],
  ['father id',         'sire_id_code'],
  ['dad id',            'sire_id_code'],

  ['sire name',         'sire_name'],
  ['sire',              'sire_name'],
  ['father',            'sire_name'],
  ['father name',       'sire_name'],
  ['dad',               'sire_name'],
  ['dad name',          'sire_name'],
  ['male parent',       'sire_name'],

  // Dam
  ['dam id code',       'dam_id_code'],
  ['dam id',            'dam_id_code'],
  ['dam code',          'dam_id_code'],
  ['mother id',         'dam_id_code'],
  ['mom id',            'dam_id_code'],

  ['dam name',          'dam_name'],
  ['dam',               'dam_name'],
  ['mother',            'dam_name'],
  ['mother name',       'dam_name'],
  ['mom',               'dam_name'],
  ['mom name',          'dam_name'],
  ['female parent',     'dam_name'],

  // Weight
  ['weight grams',      'weight_grams'],
  ['weight g',          'weight_grams'],
  ['weight (g)',        'weight_grams'],
  ['weight(g)',         'weight_grams'],
  ['weight',            'weight_grams'],
  ['grams',             'weight_grams'],
  ['mass',              'weight_grams'],
  ['mass g',            'weight_grams'],
  ['current weight',    'weight_grams'],

  // Price
  ['asking price',      'asking_price'],
  ['price',             'asking_price'],
  ['cost',              'asking_price'],
  ['listing price',     'asking_price'],
  ['sale price',        'asking_price'],
  ['value',             'asking_price'],

  // Notes
  ['notes',             'notes'],
  ['note',              'notes'],
  ['comments',          'notes'],
  ['comment',           'notes'],
  ['remarks',           'notes'],
  ['memo',              'notes'],
  ['additional info',   'notes'],
  ['info',              'notes'],

  // Breeder
  ['breeder name',      'breeder_name'],
  ['breeder',           'breeder_name'],
  ['bred by',           'breeder_name'],
  ['purchased from',    'breeder_name'],
  ['seller',            'breeder_name'],
  ['source',            'breeder_name'],
  ['origin',            'breeder_name'],

  // Genetics notes
  ['genetics notes',    'genetics_notes'],
  ['genetic notes',     'genetics_notes'],
  ['het',               'genetics_notes'],
  ['hets',              'genetics_notes'],
  ['possible hets',     'genetics_notes'],
  ['genetic info',      'genetics_notes'],

  // Estimated hatch year
  ['estimated hatch year', 'estimated_hatch_year'],
  ['hatch year',        'estimated_hatch_year'],
  ['birth year',        'estimated_hatch_year'],
  ['year',              'estimated_hatch_year'],
  ['year born',         'estimated_hatch_year'],
  ['year hatched',      'estimated_hatch_year'],

  // Pairing date (for breeding_plans)
  ['pairing date',      'pairing_date'],
  ['paired on',         'pairing_date'],
  ['paired date',       'pairing_date'],
  ['breeding date',     'pairing_date'],
  ['pair date',         'pairing_date'],
  ['date paired',       'pairing_date'],
  ['introduction date', 'pairing_date'],

  // Breeding season
  ['breeding season',   'breeding_season'],
  ['season',            'breeding_season'],
  ['breed season',      'breeding_season'],

  // Egg lay date
  ['egg lay date',      'egg_lay_date'],
  ['lay date',          'egg_lay_date'],
  ['laid on',           'egg_lay_date'],
  ['date laid',         'egg_lay_date'],
  ['laid',              'egg_lay_date'],
  ['egg laid',          'egg_lay_date'],
  ['oviposition date',  'egg_lay_date'],

  // Egg status
  ['egg status',        'egg_status'],
  ['incubation status', 'egg_status'],

  // Clutch number
  ['clutch number',     'clutch_number'],
  ['clutch no',         'clutch_number'],
  ['clutch',            'clutch_number'],
  ['clutch id',         'clutch_number'],
];

/**
 * Normalise a header string for comparison:
 * lowercase, strip non-alphanumeric (keep spaces), collapse whitespace.
 */
function normalise(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Try to auto-map an array of source CSV headers to template field keys.
 *
 * Returns an object: { [templateFieldKey]: sourceColumnIndex | null }
 * Fields that couldn't be matched get null.
 */
export function autoMapColumns(sourceHeaders) {
  const mapping = {};
  const usedSourceIndices = new Set();

  // Initialise all template fields to null
  for (const { key } of TEMPLATE_FIELDS) {
    mapping[key] = null;
  }

  // Build normalised source list
  const normHeaders = sourceHeaders.map(normalise);

  // Pass 1: exact alias matches (first alias match wins per field)
  for (const [alias, fieldKey] of ALIAS_MAP) {
    if (mapping[fieldKey] != null) continue; // already mapped
    const idx = normHeaders.findIndex(
      (h, i) => !usedSourceIndices.has(i) && h === alias
    );
    if (idx >= 0) {
      mapping[fieldKey] = idx;
      usedSourceIndices.add(idx);
    }
  }

  // Pass 2: substring / contains matching for anything still unmapped
  for (const [alias, fieldKey] of ALIAS_MAP) {
    if (mapping[fieldKey] != null) continue;
    const idx = normHeaders.findIndex(
      (h, i) => !usedSourceIndices.has(i) && (h.includes(alias) || alias.includes(h))
    );
    if (idx >= 0) {
      mapping[fieldKey] = idx;
      usedSourceIndices.add(idx);
    }
  }

  return mapping;
}

/**
 * Return an array of source header indices that were NOT mapped to any
 * template field (useful for showing the user what was skipped).
 */
export function unmappedSourceColumns(mapping, sourceHeaders) {
  const mappedIndices = new Set(Object.values(mapping).filter(v => v != null));
  return sourceHeaders
    .map((h, i) => ({ header: h, index: i }))
    .filter(({ index }) => !mappedIndices.has(index));
}

/**
 * Count how many required fields are mapped.
 */
export function requiredFieldsCovered(mapping) {
  const required = TEMPLATE_FIELDS.filter(f => f.required);
  const mapped = required.filter(f => mapping[f.key] != null);
  return { total: required.length, mapped: mapped.length, missing: required.filter(f => mapping[f.key] == null) };
}
