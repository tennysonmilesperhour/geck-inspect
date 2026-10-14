import { demoPortrait } from '../data/demo-gecko-portraits';

const GUEST_EMAIL = 'guest@local';

// Synthetic, read-only breeder ledger for guest mode. Every amount, name,
// date, and animal below is fictional; phenotype labels are not genotype
// claims. The annual result is a teaching example, not market guidance.
const COHORTS = [
  {
    year: 2024, plan: 'mock-demo-plan-2024', sire: 'mock-gecko-gp1-diamond', dam: 'mock-gecko-gp4-sunny',
    sireName: 'Diamond', damName: 'Sunny',
    pair: 'Diamond × Sunny', season: '2024 Season', pairingDate: '2023-10-18',
    hatchDates: ['2024-02-12', '2024-02-23', '2024-03-19', '2024-03-30', '2024-04-20', '2024-05-01', '2024-05-22', '2024-06-02'],
    saleDates: ['2024-10-04', '2024-10-19', '2024-11-02', '2024-11-17', '2024-12-01', '2024-12-08'],
    prices: [790, 960, 1200, 880, 1550, 1250],
    names: ['Copper', 'Pippin', 'Clover', 'Mochi', 'Saffron', 'Sprout', 'Dune', 'Cinder'],
    portraits: ['pepperjack', 'raindrop', 'moonlight', 'pony-boy', 'mossball', 'raindrop', 'odin', 'selva'],
  },
  {
    year: 2025, plan: 'mock-demo-plan-2025', sire: 'mock-gecko-8', dam: 'mock-gecko-12',
    sireName: 'Onyx', damName: 'Willow',
    pair: 'Onyx × Willow', season: '2025 Season', pairingDate: '2024-10-22',
    hatchDates: ['2025-02-20', '2025-03-01', '2025-03-22', '2025-04-01', '2025-04-22', '2025-05-02', '2025-05-23', '2025-06-02'],
    saleDates: ['2025-09-07', '2025-09-21', '2025-10-05', '2025-10-19', '2025-11-02', '2025-11-16', '2025-11-30', '2025-12-07'],
    prices: [1850, 2100, 1675, 1950, 2300, 1700, 2050, 2200],
    names: ['Juniper', 'Comet', 'Marble', 'Echo', 'Lumen', 'Tansy', 'Orbit', 'Mica'],
    portraits: ['odin', 'raindrop', 'moonlight', 'pony-boy', 'bliss', 'raindrop', 'selva', 'odin'],
  },
  {
    // Keep this successful ledger pairing distinct from the existing 2026
    // mock plans. Reusing a pair made the UI aggregate its eggs and offspring
    // into multiple season summaries.
    year: 2026, plan: 'mock-demo-plan-2026', sire: 'mock-gecko-8', dam: 'mock-gecko-3',
    sireName: 'Onyx', damName: 'Moss',
    pair: 'Onyx × Moss', season: '2026 Season to date', pairingDate: '2025-10-25',
    hatchDates: ['2026-01-29', '2026-02-09', '2026-02-28', '2026-03-10', '2026-03-29', '2026-04-08', '2026-04-27', '2026-05-07'],
    saleDates: ['2026-07-26', '2026-08-09', '2026-08-23', '2026-09-06', '2026-09-20', '2026-10-04'],
    prices: [1950, 2200, 1800, 2400, 1650, 2100],
    names: ['Biscuit', 'Kestrel', 'Poppy', 'Fable', 'Waffles', 'Miso', 'Acorn', 'Bramble II'],
    portraits: ['odin', 'raindrop', 'moonlight', 'frito', 'bliss', 'raindrop', 'cheeto', 'selva'],
  },
];

const now = new Date().toISOString();
const laidDate = (hatchDate) => {
  const d = new Date(`${hatchDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 82);
  return d.toISOString().slice(0, 10);
};

const records = COHORTS.flatMap((cohort) => cohort.names.map((name, i) => {
  const sold = i < cohort.saleDates.length;
  const hatchDate = cohort.hatchDates[i];
  const saleDate = sold ? cohort.saleDates[i] : null;
  const clutchNumber = Math.floor(i / 2) + 1;
  const clutchId = `mock-demo-clutch-${cohort.year}-${clutchNumber}`;
  const id = `mock-demo-gecko-${cohort.year}-${String(i + 1).padStart(2, '0')}`;
  return {
    id,
    name,
    sex: ['Female', 'Male', 'Unsexed'][i % 3],
    status: sold ? 'Sold' : (i === 6 ? 'Holdback' : 'For Sale'),
    hatch_date: hatchDate,
    weight_grams: 18 + ((i * 3) % 15),
    ...demoPortrait(cohort.portraits[i]),
    photo_is_illustrative: true,
    gecko_id_code: `DEMO-${cohort.year}-${String(i + 1).padStart(2, '0')}`,
    species: 'Crested Gecko',
    generation: cohort.year === 2024 ? 2 : 3,
    sire_id: cohort.sire,
    dam_id: cohort.dam,
    sire_name: cohort.sireName,
    dam_name: cohort.damName,
    clutch_id: clutchId,
    archived: sold,
    archive_reason: sold ? 'sold' : null,
    archived_date: saleDate ? `${saleDate}T12:00:00.000Z` : null,
    asking_price: sold ? cohort.prices[i] : (i === 6 ? 2400 : 1950),
    sold_price: sold ? cohort.prices[i] : null,
    sale_category: sold ? 'produced_in_house' : null,
    created_by: GUEST_EMAIL,
    created_date: `${hatchDate}T12:00:00.000Z`,
    notes: 'Fictional demo animal. Illustrative photo is matched to the listed morph; identity, pedigree, care, and sales history are sample data.',
  };
}));

export const DEMO_BREEDER_GECKOS = records;

export const DEMO_BREEDER_PLANS = COHORTS.map((c) => ({
  id: c.plan,
  breeding_id: `${c.pair} ${c.year}`,
  sire_id: c.sire,
  dam_id: c.dam,
  pairing_date: `${c.pairingDate}T12:00:00.000Z`,
  breeding_season: c.season,
  status: 'Successful',
  laying_active: false,
  archived: c.year < 2026,
  notes: 'Synthetic example pairing. Recorded visible traits only; no inferred genotype claims.',
  created_by: GUEST_EMAIL,
  created_date: `${c.pairingDate}T12:00:00.000Z`,
}));

export const DEMO_BREEDER_EGGS = COHORTS.flatMap((c) => c.hatchDates.map((hatchDate, i) => {
  const clutchNumber = Math.floor(i / 2) + 1;
  return {
    id: `mock-demo-egg-${c.year}-${i + 1}`,
    breeding_plan_id: c.plan,
    clutch_id: `mock-demo-clutch-${c.year}-${clutchNumber}`,
    lay_date: laidDate(hatchDate),
    hatch_date_expected: hatchDate,
    hatch_date_actual: hatchDate,
    status: 'Hatched',
    grade: ['A', 'A+', 'B'][i % 3],
    incubation_temp_f: 72,
    gecko_id: `mock-demo-gecko-${c.year}-${String(i + 1).padStart(2, '0')}`,
    notes: 'Synthetic demo record.',
    created_by: GUEST_EMAIL,
    created_date: `${laidDate(hatchDate)}T12:00:00.000Z`,
  };
}));

export const DEMO_BREEDER_CLUTCHES = COHORTS.flatMap((c) => {
  const clutchCount = Math.ceil(c.hatchDates.length / 2);
  return Array.from({ length: clutchCount }, (_, j) => {
    const eggs = DEMO_BREEDER_EGGS.filter((egg) => egg.clutch_id === `mock-demo-clutch-${c.year}-${j + 1}`);
    return {
      id: `mock-demo-clutch-${c.year}-${j + 1}`,
      breeding_plan_id: c.plan,
      pair_name: c.pair,
      season: c.season,
      lay_date: eggs[0]?.lay_date,
      egg_count: eggs.length,
      hatched_count: eggs.length,
      status: 'Complete',
      created_by: GUEST_EMAIL,
      created_date: `${eggs[0]?.lay_date}T12:00:00.000Z`,
    };
  });
});

const costRows = [
  // 2024 startup season is the downside case: acquisition and early costs
  // run ahead of sales. Each year's labor entry is an explicit assumption.
  ['2024-01-10', 'Foundation breeder acquisition', 3000, 'acquisition', 2024],
  ['2024-02-01', 'Food and prepared diets', 1120, 'food', 2024],
  ['2024-03-12', 'Habitat and incubation supplies', 760, 'supplies', 2024],
  ['2024-04-08', 'Routine veterinary care', 420, 'vet_care', 2024],
  ['2024-06-14', 'Local expo booth fee', 540, 'expo_fees', 2024],
  ['2024-08-02', 'Shipping and packaging', 390, 'shipping', 2024],
  ['2024-09-18', 'Utilities allocation', 360, 'utilities', 2024],
  ['2024-12-28', 'Owner labor assumption, 140 hours × $25/hour', 3500, 'other', 2024],
  ['2025-01-08', 'Additional breeder acquisition', 800, 'acquisition', 2025],
  ['2025-02-01', 'Food and prepared diets', 1580, 'food', 2025],
  ['2025-03-12', 'Habitat and incubation supplies', 520, 'supplies', 2025],
  ['2025-04-08', 'Routine veterinary care', 460, 'vet_care', 2025],
  ['2025-06-14', 'Regional expo fees', 620, 'expo_fees', 2025],
  ['2025-08-02', 'Payment processing and listing fees', 710, 'other', 2025],
  ['2025-10-18', 'Shipping and packaging', 540, 'shipping', 2025],
  ['2025-12-28', 'Owner labor assumption, 140 hours × $25/hour', 3500, 'other', 2025],
  ['2026-01-08', 'Breeder acquisition and health screening', 900, 'acquisition', 2026],
  ['2026-02-01', 'Food and prepared diets', 1260, 'food', 2026],
  ['2026-03-12', 'Habitat and incubation supplies', 470, 'supplies', 2026],
  ['2026-04-08', 'Routine veterinary care', 390, 'vet_care', 2026],
  ['2026-05-14', 'Expo fees', 500, 'expo_fees', 2026],
  ['2026-06-02', 'Utilities allocation', 320, 'utilities', 2026],
  ['2026-08-02', 'Payment processing and shipping', 620, 'shipping', 2026],
  ['2026-10-01', 'Owner labor assumption, 112 hours × $25/hour', 2800, 'other', 2026],
];

export const DEMO_BREEDER_COSTS = costRows.map(([date, description, amount, category, year], i) => ({
  id: `mock-demo-cost-${year}-${String(i + 1).padStart(2, '0')}`,
  user_email: GUEST_EMAIL,
  created_by: GUEST_EMAIL,
  date,
  description,
  amount,
  category,
  breeding_plan_id: `mock-demo-plan-${year}`,
  gecko_id: null,
  created_date: `${date}T12:00:00.000Z`,
}));

export const DEMO_BREEDER_FINANCIAL_ASSUMPTIONS = Object.freeze({
  label: 'Demo data • Fictional results, not expected earnings',
  included: ['Synthetic recorded sales', 'Breeder acquisition', 'Food and care', 'Vet care', 'Expo and processing fees', 'Shipping', 'Assumed owner labor'],
  labor: 'Owner labor is an illustrative assumption of 140 hours/year at $25/hour in 2024–2025 and 112 hours through October 2026.',
  excluded: ['Income taxes', 'Capital equipment depreciation', 'Insurance', 'Financing costs', 'Unplanned medical events'],
});

export function validateDemoBreederLedger() {
  const geckoIds = new Set(DEMO_BREEDER_GECKOS.map((g) => g.id));
  const eggIds = new Set(DEMO_BREEDER_EGGS.map((e) => e.id));
  const planIds = new Set(DEMO_BREEDER_PLANS.map((p) => p.id));
  const plansById = new Map(DEMO_BREEDER_PLANS.map((p) => [p.id, p]));
  const clutchIds = new Set(DEMO_BREEDER_CLUTCHES.map((c) => c.id));
  const issues = [];
  for (const egg of DEMO_BREEDER_EGGS) {
    if (!geckoIds.has(egg.gecko_id)) issues.push(`Egg ${egg.id} links to missing gecko ${egg.gecko_id}`);
    if (!planIds.has(egg.breeding_plan_id)) issues.push(`Egg ${egg.id} links to missing plan`);
    if (!clutchIds.has(egg.clutch_id)) issues.push(`Egg ${egg.id} links to missing clutch`);
    if (egg.lay_date >= egg.hatch_date_actual) issues.push(`Egg ${egg.id} has invalid dates`);
    if (egg.lay_date <= plansById.get(egg.breeding_plan_id)?.pairing_date.slice(0, 10)) issues.push(`Egg ${egg.id} predates its pairing`);
  }
  for (const gecko of DEMO_BREEDER_GECKOS) {
    if (gecko.clutch_id && !clutchIds.has(gecko.clutch_id)) issues.push(`Gecko ${gecko.id} links to missing clutch`);
    if (gecko.sold_price && !gecko.archived) issues.push(`Sold gecko ${gecko.id} remains active in inventory`);
    if (gecko.sold_price && gecko.archived_date?.slice(0, 10) <= gecko.hatch_date) issues.push(`Sold gecko ${gecko.id} sold before hatching`);
  }
  if (eggIds.size !== DEMO_BREEDER_EGGS.length) issues.push('Duplicate demo egg id');
  for (const clutch of DEMO_BREEDER_CLUTCHES) {
    const linked = DEMO_BREEDER_EGGS.filter((egg) => egg.clutch_id === clutch.id).length;
    if (linked !== clutch.egg_count || linked !== clutch.hatched_count) issues.push(`Clutch ${clutch.id} counts do not reconcile`);
  }
  for (const cost of DEMO_BREEDER_COSTS) {
    if (!planIds.has(cost.breeding_plan_id)) issues.push(`Cost ${cost.id} links to missing pairing`);
    if (!Number.isFinite(cost.amount) || cost.amount <= 0) issues.push(`Cost ${cost.id} has an invalid amount`);
  }
  return issues;
}
