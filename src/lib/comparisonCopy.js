// Fills Geck Inspect's own numbers into the /compare copy
// (src/data/comparisons.js), so a price change in stripe-config.js reaches
// every comparison page and its prerendered HTML. Dependency-free so the
// prerender script can import it.
import { TIER_PRICING } from './stripe-config.js';
import { TIER_LIMITS } from './tierLimits.js';
import { MORPH_GUIDE_COUNT } from '../data/comparisons.js';

export const COMPARISON_FILL = {
  freeGeckos: String(TIER_LIMITS.free.maxGeckos),
  keeper: TIER_PRICING.keeper.monthly.price,
  breeder: TIER_PRICING.breeder.monthly.price,
  keeperAnnual: TIER_PRICING.keeper.annual.price,
  breederAnnual: TIER_PRICING.breeder.annual.price,
  morphCount: String(MORPH_GUIDE_COUNT),
};

export const fillComparison = (text) => text.replace(/\{(\w+)\}/g, (match, key) => COMPARISON_FILL[key] ?? match);
