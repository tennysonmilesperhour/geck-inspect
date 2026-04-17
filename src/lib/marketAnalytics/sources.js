/**
 * Market Analytics — Data Source Registry
 *
 * Every data point surfaced in the analytics module must be traceable
 * to a source. This file is the single source of truth for:
 *   - the kind of source (first-party internal vs external scraped)
 *   - how trustworthy we consider the source (base confidence)
 *   - how fresh we expect the source's data to be (refresh cadence)
 *   - region coverage and any regional bias
 *
 * The visualization layer surfaces these via <SourceBadge /> so that a
 * buyer at a multi-thousand-dollar subscription tier can see *exactly*
 * whether a number is internal truth, a public scrape, or an estimate.
 */

export const SOURCE_KINDS = {
  INTERNAL:  'internal',   // generated inside Geck Inspect
  SCRAPED:   'scraped',    // ingested from public external site
  ESTIMATED: 'estimated',  // derived / modeled / extrapolated
};

// Base confidence is a 0..1 prior. The queries layer multiplies this
// with sample-size adjustments to produce a final confidence score.
export const DATA_SOURCES = [
  // ----- First-party / internal -----
  {
    id: 'internal.sales',
    kind: SOURCE_KINDS.INTERNAL,
    label: 'Geck Inspect sales',
    short: 'GI sales',
    description: 'Completed sales recorded by users inside Geck Inspect.',
    regions: ['US', 'EU', 'UK', 'CA', 'AU', 'JP', 'SE', 'SEA'],
    refresh_minutes: 5,
    base_confidence: 0.95,
  },
  {
    id: 'internal.listings',
    kind: SOURCE_KINDS.INTERNAL,
    label: 'Geck Inspect listings',
    short: 'GI listings',
    description: 'Active asking-prices set by users on their own listings.',
    regions: ['US', 'EU', 'UK', 'CA', 'AU', 'JP', 'SE', 'SEA'],
    refresh_minutes: 5,
    base_confidence: 0.85,
  },
  {
    id: 'internal.breeding',
    kind: SOURCE_KINDS.INTERNAL,
    label: 'Geck Inspect breeding records',
    short: 'GI breeding',
    description: 'Pairings, clutches, hatchlings logged in-app — used for supply pipeline forecasts.',
    regions: ['US', 'EU', 'UK', 'CA', 'AU', 'JP', 'SE', 'SEA'],
    refresh_minutes: 60,
    base_confidence: 0.9,
  },
  {
    id: 'internal.behavior',
    kind: SOURCE_KINDS.INTERNAL,
    label: 'Geck Inspect search & watchlist behavior',
    short: 'GI demand',
    description: 'Search queries, saved watchlists, saved geckos — a leading indicator of demand.',
    regions: ['US', 'EU', 'UK', 'CA', 'AU', 'JP', 'SE', 'SEA'],
    refresh_minutes: 15,
    base_confidence: 0.75,
  },

  // ----- External / scraped -----
  {
    id: 'external.morphmarket',
    kind: SOURCE_KINDS.SCRAPED,
    label: 'MorphMarket',
    short: 'MM',
    description: 'Public classifieds — active listings and sold markers.',
    regions: ['US', 'EU', 'UK', 'CA', 'AU'],
    refresh_minutes: 360,
    base_confidence: 0.8,
  },
  {
    id: 'external.pangea',
    kind: SOURCE_KINDS.SCRAPED,
    label: 'Pangea forums & marketplace',
    short: 'Pangea',
    description: 'Longtime hobbyist community marketplace and breeder discussion.',
    regions: ['US', 'EU', 'UK', 'CA'],
    refresh_minutes: 720,
    base_confidence: 0.65,
  },
  {
    id: 'external.fb',
    kind: SOURCE_KINDS.SCRAPED,
    label: 'Facebook breeder groups',
    short: 'FB',
    description: 'Private group posts and comments — noisy but often where regional deals happen first.',
    regions: ['US', 'EU', 'UK', 'AU', 'SE'],
    refresh_minutes: 720,
    base_confidence: 0.4,
  },
  {
    id: 'external.eu_classifieds',
    kind: SOURCE_KINDS.SCRAPED,
    label: 'EU reptile classifieds',
    short: 'EU CL',
    description: 'Terraristik, Snakebuddies, Kleinanzeigen — regional EU listings.',
    regions: ['EU', 'UK', 'SE'],
    refresh_minutes: 720,
    base_confidence: 0.7,
  },
  {
    id: 'external.jp_classifieds',
    kind: SOURCE_KINDS.SCRAPED,
    label: 'Japanese classifieds',
    short: 'JP CL',
    description: 'Japanese marketplace and specialty shop listings.',
    regions: ['JP'],
    refresh_minutes: 1440,
    base_confidence: 0.6,
  },
  {
    id: 'external.breeder_sites',
    kind: SOURCE_KINDS.SCRAPED,
    label: 'Direct breeder sites',
    short: 'Breeder',
    description: 'Named-breeder direct websites — availability and release announcements.',
    regions: ['US', 'EU', 'UK', 'AU'],
    refresh_minutes: 360,
    base_confidence: 0.9,
  },
  {
    id: 'external.expos',
    kind: SOURCE_KINDS.SCRAPED,
    label: 'Reptile expo announcements',
    short: 'Expo',
    description: 'Vendor lists and pre-show release announcements — leading indicator of seasonal supply.',
    regions: ['US', 'EU', 'UK'],
    refresh_minutes: 1440,
    base_confidence: 0.55,
  },

  // ----- Derived / modeled -----
  {
    id: 'estimated.blend',
    kind: SOURCE_KINDS.ESTIMATED,
    label: 'Blended estimate',
    short: 'Blend',
    description: 'Weighted combination of multiple sources — used when a single source lacks coverage.',
    regions: ['US', 'EU', 'UK', 'CA', 'AU', 'JP', 'SE', 'SEA'],
    refresh_minutes: 15,
    base_confidence: 0.7,
  },
  {
    id: 'estimated.forecast',
    kind: SOURCE_KINDS.ESTIMATED,
    label: 'Forecast / projection',
    short: 'Forecast',
    description: 'Model output for forward-looking projections — always shown with a confidence band.',
    regions: ['US', 'EU', 'UK', 'CA', 'AU', 'JP', 'SE', 'SEA'],
    refresh_minutes: 60,
    base_confidence: 0.5,
  },
];

export const SOURCES_BY_ID = Object.fromEntries(DATA_SOURCES.map((s) => [s.id, s]));

/** Return the source record, or a minimal stub if the id is unknown. */
export function getSource(id) {
  return SOURCES_BY_ID[id] || {
    id,
    kind: SOURCE_KINDS.ESTIMATED,
    label: id,
    short: id,
    base_confidence: 0.5,
    refresh_minutes: 1440,
  };
}

/** A user-facing freshness label like "5m ago" given a refresh_minutes. */
export function freshnessLabel(mins) {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

/** True if this source id is first-party / internal to Geck Inspect. */
export function isInternal(id) {
  return getSource(id).kind === SOURCE_KINDS.INTERNAL;
}
