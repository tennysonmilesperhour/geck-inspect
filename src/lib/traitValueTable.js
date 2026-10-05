/**
 * Loads the Geck Data trait value table (public.trait_value_table) for
 * the Portfolio and gecko pages. The RPC is one ~1s scan of Geck Data
 * listings server-side and only moves when a scrape lands, so the rows
 * and the built index are cached for the session and shared by every
 * page that asks. Signed-in users only; the RPC is not granted to anon.
 */
import { supabase } from '@/lib/supabaseClient';
import { buildTraitValueIndex } from '@/lib/traitValuation';
import { isGuestMode } from '@/lib/guestMode';

const TTL_MS = 30 * 60_000;
const PAGE = 1000;

let cache = null;
let inflight = null;

async function fetchRows() {
  // PostgREST caps a response at 1000 rows, so page until a short page.
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .rpc('trait_value_table')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

let demoIndex = null;

/**
 * Resolves to the trait value index (see buildTraitValueIndex). Throws on
 * failure. In the guest demo there is no session to call the RPC with, so
 * the index is built from a dated snapshot of the same table
 * (src/data/demoTraitValues.js) and the demo shows real-shaped prices.
 */
export async function loadTraitValueIndex() {
  if (isGuestMode()) {
    if (!demoIndex) {
      const { demoTraitValueRows } = await import('@/data/demoTraitValues');
      demoIndex = buildTraitValueIndex(demoTraitValueRows());
    }
    return demoIndex;
  }
  if (cache && Date.now() - cache.at < TTL_MS) return cache.index;
  if (!inflight) {
    inflight = fetchRows()
      .then((rows) => {
        cache = { index: buildTraitValueIndex(rows), at: Date.now() };
        return cache.index;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}
