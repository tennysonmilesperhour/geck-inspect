/**
 * Loads the Market Analytics v2 aggregates from public.market_analytics_v2().
 * One jsonb object, a few scans of Geck Data listings server-side, and it
 * only moves when a scrape lands, so it is cached for the session.
 * Signed-in users only; the RPC is not granted to anon.
 */
import { supabase } from '@/lib/supabaseClient';

const TTL_MS = 30 * 60_000;

let cache = null;
let inflight = null;

/** Resolves to the aggregates object (shape in demoAggregates.js). Throws on failure. */
export async function loadMarketAggregates({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (!inflight) {
    inflight = supabase
      .rpc('market_analytics_v2')
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data || !Array.isArray(data.traits) || !data.coverage) {
          throw new Error('Market data came back empty.');
        }
        cache = { data, at: Date.now() };
        return data;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}
