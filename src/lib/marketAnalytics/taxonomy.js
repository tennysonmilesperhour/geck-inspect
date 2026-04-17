/**
 * Market Analytics Taxonomy
 *
 * Canonical reference data for the Market Analytics module. Nothing in
 * here should depend on the visualization layer — this is pure data the
 * UI consumes. If a new morph, region, or lineage tier is introduced,
 * update this file and the rest of the analytics layer picks it up.
 *
 * The crested gecko market does NOT price single-trait morphs uniformly.
 * Real value is driven by (a) visible-trait combinations, (b) recessive
 * het depth, (c) lineage / breeder provenance, and (d) animal age class.
 * This taxonomy is structured around those axes so every chart, filter,
 * and query can reason about them.
 */

// ---------- Trait classification --------------------------------------
// The "kind" of a trait changes how it contributes to price. Structural
// traits (pinstripe, dalmatian, etc.) stack with color traits; recessive
// traits (Axanthic, Cappuccino) only visually express when homozygous
// but carry significant value as heterozygous carriers.
export const TRAIT_KINDS = {
  COLOR: 'color',
  PATTERN: 'pattern',
  STRUCTURAL: 'structural',
  RECESSIVE: 'recessive',
  CODOMINANT: 'codominant',
  POLYGENIC: 'polygenic',
};

// ---------- Canonical morph list --------------------------------------
// Curated to match the morphs that actually move volume or command
// premiums in 2025. Not exhaustive — the analytics module can be pointed
// at any morph but this is the "watched list" surfaced in default views.
export const CANONICAL_MORPHS = [
  // Recessive (homozygous-expressing) — drive the largest premiums
  { name: 'Lilly White',        kind: TRAIT_KINDS.CODOMINANT,  premium_tier: 'flagship' },
  { name: 'Axanthic',           kind: TRAIT_KINDS.RECESSIVE,   premium_tier: 'flagship' },
  { name: 'Cappuccino',         kind: TRAIT_KINDS.RECESSIVE,   premium_tier: 'flagship' },
  { name: 'Sable',              kind: TRAIT_KINDS.RECESSIVE,   premium_tier: 'premium' },
  { name: 'Frappuccino',        kind: TRAIT_KINDS.RECESSIVE,   premium_tier: 'premium' },
  { name: 'Moonglow',           kind: TRAIT_KINDS.POLYGENIC,   premium_tier: 'premium' },
  // Structural — stack with color/pattern
  { name: 'Full Pinstripe',     kind: TRAIT_KINDS.STRUCTURAL,  premium_tier: 'premium' },
  { name: 'Pinstripe',          kind: TRAIT_KINDS.STRUCTURAL,  premium_tier: 'mid' },
  { name: 'Phantom Pinstripe',  kind: TRAIT_KINDS.STRUCTURAL,  premium_tier: 'premium' },
  { name: 'Empty Back',         kind: TRAIT_KINDS.STRUCTURAL,  premium_tier: 'mid' },
  { name: 'Soft Scale',         kind: TRAIT_KINDS.STRUCTURAL,  premium_tier: 'flagship' },
  // Pattern
  { name: 'Harlequin',          kind: TRAIT_KINDS.PATTERN,     premium_tier: 'mid' },
  { name: 'Extreme Harlequin',  kind: TRAIT_KINDS.PATTERN,     premium_tier: 'premium' },
  { name: 'Tiger',              kind: TRAIT_KINDS.PATTERN,     premium_tier: 'mid' },
  { name: 'Brindle',            kind: TRAIT_KINDS.PATTERN,     premium_tier: 'mid' },
  { name: 'Dalmatian',          kind: TRAIT_KINDS.PATTERN,     premium_tier: 'mid' },
  { name: 'Super Dalmatian',    kind: TRAIT_KINDS.PATTERN,     premium_tier: 'premium' },
  { name: 'Flame',              kind: TRAIT_KINDS.PATTERN,     premium_tier: 'entry' },
  { name: 'Bicolor',            kind: TRAIT_KINDS.PATTERN,     premium_tier: 'entry' },
  { name: 'Patternless',        kind: TRAIT_KINDS.PATTERN,     premium_tier: 'entry' },
  // Color
  { name: 'Red',                kind: TRAIT_KINDS.COLOR,       premium_tier: 'mid' },
  { name: 'Yellow',             kind: TRAIT_KINDS.COLOR,       premium_tier: 'entry' },
  { name: 'Cream',              kind: TRAIT_KINDS.COLOR,       premium_tier: 'entry' },
  { name: 'Orange',             kind: TRAIT_KINDS.COLOR,       premium_tier: 'mid' },
];

export const MORPH_NAMES = CANONICAL_MORPHS.map((m) => m.name);

// ---------- Trait combinations the market actually prices -------------
// These are the combos buyers search for; pricing is driven at the combo
// level, NOT at the single-trait level. Ordered roughly by global demand.
export const HIGH_VALUE_COMBOS = [
  { id: 'lw-axa',       name: 'Lilly White × Axanthic',        traits: ['Lilly White', 'Axanthic'] },
  { id: 'lw-cap',       name: 'Lilly White × Cappuccino',      traits: ['Lilly White', 'Cappuccino'] },
  { id: 'cap-pin',      name: 'Cappuccino × Full Pinstripe',   traits: ['Cappuccino', 'Full Pinstripe'] },
  { id: 'axa-pin',      name: 'Axanthic × Full Pinstripe',     traits: ['Axanthic', 'Full Pinstripe'] },
  { id: 'sable-harl',   name: 'Sable × Extreme Harlequin',     traits: ['Sable', 'Extreme Harlequin'] },
  { id: 'frap-pin',     name: 'Frappuccino × Pinstripe',       traits: ['Frappuccino', 'Pinstripe'] },
  { id: 'moonglow-dal', name: 'Moonglow × Super Dalmatian',    traits: ['Moonglow', 'Super Dalmatian'] },
  { id: 'lw-soft',      name: 'Lilly White × Soft Scale',      traits: ['Lilly White', 'Soft Scale'] },
  { id: 'axa-harl',     name: 'Axanthic × Extreme Harlequin',  traits: ['Axanthic', 'Extreme Harlequin'] },
  { id: 'cap-dal',      name: 'Cappuccino × Super Dalmatian',  traits: ['Cappuccino', 'Super Dalmatian'] },
  { id: 'red-harl',     name: 'Red Harlequin',                 traits: ['Red', 'Harlequin'] },
  { id: 'tiger-pin',    name: 'Tiger × Pinstripe',             traits: ['Tiger', 'Pinstripe'] },
];

// ---------- Regions ----------------------------------------------------
// Import friction indicates how hard it is to move animals into the
// region (CITES-adjacent paperwork, airline restrictions, vet certs,
// quarantine). Higher friction creates arbitrage windows but also
// reduces the effective arbitrage edge after shipping costs.
export const REGIONS = [
  { code: 'US',   name: 'United States',   currency: 'USD', import_friction: 0.1, population_tier: 'large' },
  { code: 'EU',   name: 'European Union',  currency: 'EUR', import_friction: 0.6, population_tier: 'large' },
  { code: 'UK',   name: 'United Kingdom',  currency: 'GBP', import_friction: 0.7, population_tier: 'mid'   },
  { code: 'CA',   name: 'Canada',          currency: 'CAD', import_friction: 0.4, population_tier: 'mid'   },
  { code: 'AU',   name: 'Australia',       currency: 'AUD', import_friction: 0.95, population_tier: 'mid'  },
  { code: 'JP',   name: 'Japan',           currency: 'JPY', import_friction: 0.8, population_tier: 'mid'   },
  { code: 'SE',   name: 'Sweden / Nordics',currency: 'SEK', import_friction: 0.5, population_tier: 'small' },
  { code: 'SEA',  name: 'Southeast Asia',  currency: 'USD', import_friction: 0.85, population_tier: 'small' },
];

export const REGION_CODES = REGIONS.map((r) => r.code);

// ---------- Age / life-stage classes ----------------------------------
// Pricing is structurally different across these classes. A proven
// breeder female can be 3-5x the price of the same morph hatchling.
export const AGE_CLASSES = [
  { code: 'baby',      label: 'Baby (<5g)',                price_multiplier: 1.0 },
  { code: 'juvenile',  label: 'Juvenile (5-15g)',          price_multiplier: 1.25 },
  { code: 'subadult',  label: 'Sub-adult (15-30g)',        price_multiplier: 1.6 },
  { code: 'adult',     label: 'Adult (30g+, unproven)',    price_multiplier: 2.0 },
  { code: 'proven_m',  label: 'Proven breeder (male)',     price_multiplier: 2.6 },
  { code: 'proven_f',  label: 'Proven breeder (female)',   price_multiplier: 3.4 },
];

// ---------- Lineage / breeder tier -----------------------------------
// Same visible phenotype commands 2-10x across these tiers.
export const LINEAGE_TIERS = [
  { code: 'unknown',       label: 'Unknown / unverified',   price_multiplier: 1.0 },
  { code: 'hobby',         label: 'Hobbyist line',          price_multiplier: 1.1 },
  { code: 'regional_known',label: 'Regional known breeder', price_multiplier: 1.6 },
  { code: 'named',         label: 'Named breeder, direct',  price_multiplier: 2.4 },
  { code: 'og_line',       label: 'OG / founder line',      price_multiplier: 4.0 },
];

// ---------- Sex filters -----------------------------------------------
export const SEX_OPTIONS = [
  { value: 'all',     label: 'All sexes' },
  { value: 'female',  label: 'Female' },
  { value: 'male',    label: 'Male' },
  { value: 'unsexed', label: 'Unsexed' },
];

// ---------- Timeframes ------------------------------------------------
export const TIMEFRAMES = [
  { code: '30d',  label: '30 days',  months: 1 },
  { code: '90d',  label: '90 days',  months: 3 },
  { code: '6m',   label: '6 months', months: 6 },
  { code: '12m',  label: '12 months',months: 12 },
  { code: '24m',  label: '24 months',months: 24 },
];
