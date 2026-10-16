/**
 * The newest few weigh-ins of each of the member's geckos, for My Geckos.
 *
 * My Geckos used to read every weight record the member had ever saved
 * and pick each card's latest weight in the browser. The API answers at
 * most 1,000 rows per request, newest first, so a breeder past 1,000
 * weigh-ins silently lost the weight (and the weight sort and breeding
 * readiness) of every gecko last weighed before the 1,000th newest record.
 *
 * public.recent_weight_records (supabase/migrations/20261016090200_perf.sql)
 * returns at most `perGecko` records per gecko, so the answer grows with
 * the number of geckos, not with years of history; this pages through it
 * in case even that passes 1,000 rows.
 *
 * Until that migration is live (the site can deploy a minute before the
 * database), the old read is used, so nothing breaks in between.
 */
import { getSupabase } from '@/lib/supabaseLazy';
import { WeightRecord } from '@/entities/all';
import { isGuestMode } from '@/lib/guestMode';

export const WEIGHTS_PER_GECKO = 8;
const PAGE = 1000;
const MAX_PAGES = 20;

/** The function is not in this database yet (PostgREST and Postgres codes). */
export function isMissingFunction(error) {
  if (!error) return false;
  return error.code === 'PGRST202' || error.code === '42883'
    || /could not find the function/i.test(error.message || '');
}

const newestFirst = (a, b) => String(b.record_date || '').localeCompare(String(a.record_date || ''));

export async function loadRecentWeights(email, { perGecko = WEIGHTS_PER_GECKO } = {}) {
  // The demo's sample records come from the guest data layer.
  if (isGuestMode()) return WeightRecord.filter({ created_by: email }, '-record_date');
  const supabase = await getSupabase();
  const rows = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE;
    const { data, error } = await supabase
      .rpc('recent_weight_records', { p_per_gecko: perGecko })
      .range(from, from + PAGE - 1);
    if (error) {
      if (page === 0 && isMissingFunction(error)) {
        return WeightRecord.filter({ created_by: email }, '-record_date');
      }
      throw error;
    }
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  // Same order the old read returned, which the cards and sorts expect.
  return rows.sort(newestFirst);
}
