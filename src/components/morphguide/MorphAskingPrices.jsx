import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PRICE_DATA_TERMS,
  PRICE_MARKET_NAMES,
  applyPricePolicy,
  priceCheckDay,
  priceRowsForMorph,
  staleMarkets,
} from '@/lib/priceIndexPolicy';

/**
 * Current asking prices for one morph on its Morph Guide page, from the
 * Geck Inspect Price Index (the static /data/price-index.json that
 * scripts/build-agent-data.mjs writes on every deploy).
 *
 * Why: the guide's "typical adult price" is a hand-written range, and the
 * index has the live median for the same trait label. Until now that number
 * was only in the MCP answer and the index files. The server HTML for
 * crawlers carries the same rows (scripts/prerender.mjs).
 *
 * The index is not part of the CC BY 4.0 morph catalog: its numbers are
 * free to cite with a link, so the block names the index and links it.
 * A market not fully checked for over a week says so. Renders nothing
 * when the index has no rows for this morph or the file fails to load.
 */

const usd = (n) => `$${Math.round(Number(n) || 0).toLocaleString('en-US')}`;

let indexPromise = null;
function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch('/data/price-index.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => applyPricePolicy(data));
    indexPromise.catch(() => { indexPromise = null; });
  }
  return indexPromise;
}

export default function MorphAskingPrices({ morph }) {
  const [index, setIndex] = useState(null);

  useEffect(() => {
    let live = true;
    loadIndex().then((data) => live && setIndex(data)).catch(() => {});
    return () => { live = false; };
  }, []);

  const rows = priceRowsForMorph(index, morph);
  if (!rows.length) return null;
  const stale = new Map(staleMarkets(index).map((st) => [st.market, st]));
  const traits = [...new Set(rows.map((r) => r.trait))];

  return (
    <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5" data-testid="morph-asking-prices">
      <h3 className="text-base font-semibold text-white">Current asking prices</h3>
      <p className="mt-1 text-sm text-neutral-400">
        Listings labelled {traits.map((t) => `"${t}"`).join(' and ')}, from the Geck Inspect Price Index. Asking prices on
        public listings converted to USD, not sale prices.
      </p>
      <ul className="mt-3 divide-y divide-neutral-800">
        {rows.map((r) => {
          const st = stale.get(r.market);
          return (
            <li key={`${r.market}-${r.trait}`} className="py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm font-medium text-neutral-200">{PRICE_MARKET_NAMES[r.market] || r.market}</span>
                <span className="text-lg font-semibold text-white">{usd(r.median)} <span className="text-xs font-normal text-neutral-400">median</span></span>
              </div>
              <p className="text-xs text-neutral-400">
                Middle half {usd(r.p25)} to {usd(r.p75)}, {Number(r.listings).toLocaleString('en-US')} listings
                {r.thin ? ' (thin sample)' : ''}, checked {priceCheckDay(r.checked_on)}.
                {st ? <span className="text-amber-300"> Out of date: {st.days} days since the last full check.</span> : null}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-neutral-500">
        {PRICE_DATA_TERMS} Every trait and market: <Link to="/crested-gecko-price" className="text-emerald-300 underline">Price Index</Link>.
      </p>
    </div>
  );
}
