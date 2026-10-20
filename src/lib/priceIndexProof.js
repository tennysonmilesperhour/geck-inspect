// The counted proof line for the Geck Inspect Price Index: how many
// crested gecko asking prices the latest full check read, across how many
// markets, and when. Read from the same /data/price-index.json the price
// pages use. The all-traits row of each market (trait null) is that
// market's total, so the sum counts every listing once.
//
// Honesty rule (same as LiveStats): no number is better than a stale or
// tiny one. Null means "do not show the line".
export const PROOF_MIN_LISTINGS = 1000;
export const PROOF_MAX_AGE_DAYS = 45;

export function priceIndexProof(index, now = Date.now()) {
  const totals = (index?.latest || []).filter((row) => row && row.trait == null && Number(row.listings) > 0);
  if (!totals.length) return null;
  const listings = totals.reduce((sum, row) => sum + Number(row.listings), 0);
  const checkedOn = totals.map((row) => row.checked_on).filter(Boolean).sort().pop() || null;
  if (!checkedOn || listings < PROOF_MIN_LISTINGS) return null;
  const ageDays = (now - Date.parse(`${checkedOn}T00:00:00Z`)) / 86400000;
  if (!(ageDays <= PROOF_MAX_AGE_DAYS)) return null;
  return { listings, markets: totals.length, checkedOn };
}

export function formatCheckedOn(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}
