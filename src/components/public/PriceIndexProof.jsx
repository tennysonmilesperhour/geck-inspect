import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCheckedOn, priceIndexProof } from '@/lib/priceIndexProof';

/**
 * One line of counted proof: "Built from 10,244 crested gecko asking
 * prices in 4 markets, checked 6 October 2026." The number is read live
 * from /data/price-index.json, never typed, and the line hides itself when
 * the file is missing, small or old (src/lib/priceIndexProof.js).
 */
export default function PriceIndexProof({ className = '' }) {
  const [proof, setProof] = useState(null);
  useEffect(() => {
    let live = true;
    fetch('/data/price-index.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => live && setProof(priceIndexProof(data)))
      .catch(() => {});
    return () => { live = false; };
  }, []);
  if (!proof) return null;
  return (
    <p className={className}>
      The <Link to="/data" className="underline underline-offset-2 hover:text-white">Geck Inspect Price Index</Link> is built from{' '}
      <span className="font-semibold text-slate-200 tabular-nums">{proof.listings.toLocaleString('en-US')}</span> crested gecko asking prices in{' '}
      {proof.markets} markets, last checked {formatCheckedOn(proof.checkedOn)}.
    </p>
  );
}
