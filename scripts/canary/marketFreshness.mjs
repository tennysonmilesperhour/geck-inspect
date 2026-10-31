// The full-catalog freshness check for the daily canary. "Some new listings
// in 3 days" stays true while only the 30-minute newest-listings route runs,
// so on 28 Oct 2026 the canary passed although the last complete pass was
// 19 Oct and the US Price Index's last full day was 6 Oct. This reads the
// two dates public.market_data_health() reports (since 20261028015600) and
// fails when either is more than MAX_AGE_DAYS old.

export const MAX_AGE_DAYS = 9;

const DAY_MS = 86_400_000;

function ageDays(value, now) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? (now - t) / DAY_MS : null;
}

/**
 * @param {object} health  the market_data_health() result
 * @param {number} now     Date.now() in milliseconds
 * @returns {{ ok: boolean, detail: string }}
 */
export function fullPassFreshness(health, now) {
  if (!health || !('last_complete_pass_at' in health)) {
    return { ok: false, detail: 'market_data_health does not report full passes yet (migration 20261028015600 not applied)' };
  }
  const passAge = ageDays(health.last_complete_pass_at, now);
  // A day with no time: count from the end of that UTC day.
  const dayAge = health.us_last_full_day ? ageDays(`${health.us_last_full_day}T23:59:59Z`, now) : null;
  const passOk = passAge !== null && passAge <= MAX_AGE_DAYS;
  const dayOk = dayAge !== null && dayAge <= MAX_AGE_DAYS;
  const coverage = health.coverage_pct == null ? 'unknown' : `${health.coverage_pct}%`;
  const detail = [
    `last complete pass ${health.last_complete_pass_at ? String(health.last_complete_pass_at).slice(0, 10) : 'never'}`,
    `US Price Index last full day ${health.us_last_full_day || 'never'}`,
    `${coverage} of live listings re-observed in 48 hours`,
    passOk && dayOk ? null : 'restarting the full US pass is an owner decision (docs/planning/market-habit-2026-09-30.md)',
  ].filter(Boolean).join('; ');
  return { ok: passOk && dayOk, detail };
}
