import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// The Geck Inspect Price Index table: current asking prices by trait for
// one market, read from the static /data/price-index.json that
// scripts/build-agent-data.mjs writes on every deploy. Shown on /data and
// /crested-gecko-price.

const MARKETS = [
  { id: 'US', label: 'United States' },
  { id: 'KR', label: 'South Korea' },
  { id: 'JP', label: 'Japan' },
  { id: 'EU', label: 'Europe' },
];

// Market trait labels that name a different Morph Guide page.
const TRAIT_SLUGS = {
  'Tri-color': 'tricolor',
  Phantom: 'phantom-pinstripe',
  'Red Base': 'red-base',
  'Yellow Base': 'yellow-base',
  'Extreme Harlequin': 'extreme-harlequin',
  'Super Dalmatian': 'super-dalmatian',
  'Lilly White': 'lilly-white',
  'Soft Scale': 'soft-scale',
  'White Wall': 'white-wall',
  'Reverse Pinstripe': 'reverse-pinstripe',
};
const GUIDE_TRAITS = new Set([
  'Harlequin', 'Pinstripe', 'Dalmatian', 'Tiger', 'Brindle', 'Axanthic', 'Cappuccino',
  'Patternless', 'Lavender', 'Olive', 'Cream', 'Buckskin', 'Hypo',
]);
const slugFor = (trait) => TRAIT_SLUGS[trait] || (GUIDE_TRAITS.has(trait) ? trait.toLowerCase() : null);

const usd = (n) => (n == null ? 'n/a' : `$${Math.round(Number(n)).toLocaleString('en-US')}`);

export default function PriceIndexTable({ limit = null }) {
  const [index, setIndex] = useState(null);
  const [failed, setFailed] = useState(false);
  const [market, setMarket] = useState('US');

  useEffect(() => {
    let live = true;
    fetch('/data/price-index.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => live && setIndex(data))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) return null;
  if (!index) {
    return <div className="h-40 rounded-lg bg-slate-800/40 animate-pulse" aria-label="Loading prices" />;
  }

  const rows = index.latest.filter((r) => r.market === market);
  const all = rows.find((r) => !r.trait);
  const traits = rows.filter((r) => r.trait).sort((a, b) => b.listings - a.listings);
  const shown = limit ? traits.slice(0, limit) : traits;
  const available = MARKETS.filter((m) => index.latest.some((r) => r.market === m.id));

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3" role="tablist" aria-label="Market">
        {available.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={market === m.id}
            onClick={() => setMarket(m.id)}
            className={`touch:min-h-11 text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
              market === m.id
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'border-slate-600 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {all && (
        <p className="text-slate-300 text-sm mb-3">
          All crested geckos: median asking price <strong className="text-slate-100">{usd(all.median)}</strong> across{' '}
          {all.listings.toLocaleString('en-US')} listings, middle half {usd(all.p25)} to {usd(all.p75)} (checked {all.checked_on}).
        </p>
      )}
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-700">
              <th scope="col" className="py-2 px-1 font-medium">Trait</th>
              <th scope="col" className="py-2 px-1 font-medium text-right">Listings</th>
              <th scope="col" className="py-2 px-1 font-medium text-right">Median</th>
              <th scope="col" className="py-2 px-1 font-medium text-right hidden sm:table-cell">Middle half</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const slug = slugFor(r.trait);
              return (
                <tr key={r.trait} className="border-b border-slate-800">
                  <th scope="row" className="py-2 px-1 text-left font-normal text-slate-200">
                    {slug ? (
                      <Link to={`/MorphGuide/${slug}`} className="text-emerald-400 hover:text-emerald-300">{r.trait}</Link>
                    ) : r.trait}
                  </th>
                  <td className="py-2 px-1 text-right text-slate-400">{r.listings.toLocaleString('en-US')}</td>
                  <td className="py-2 px-1 text-right text-slate-100 font-medium">
                    {usd(r.median)}
                    <span className="block sm:hidden text-xs font-normal text-slate-500 whitespace-nowrap">{usd(r.p25)} to {usd(r.p75)}</span>
                  </td>
                  <td className="py-2 px-1 text-right text-slate-400 whitespace-nowrap hidden sm:table-cell">{usd(r.p25)} to {usd(r.p75)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-slate-500 text-xs mt-3 leading-relaxed">
        Geck Inspect Price Index. Asking prices on public crested gecko listings, converted to USD, not sale prices.
        A trait label is the seller&apos;s and does not prove genotype. Traits with fewer than 5 listings are left out.{' '}
        <Link to="/data" className="text-emerald-400 hover:text-emerald-300">Download the data</Link>.
      </p>
    </div>
  );
}
