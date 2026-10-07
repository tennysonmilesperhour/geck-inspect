import GeckoImage from '@/components/shared/GeckoImage';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import PriceBandBar from '@/components/market/PriceBandBar';
import { formatUsd, morphLabel, positionLabel, sexAgeLabel } from '@/lib/marketHabit';

const POSITION_STYLES = {
  low: 'bg-emerald-900/40 border-emerald-700 text-emerald-200',
  typical: 'bg-slate-800/60 border-slate-600 text-slate-200',
  high: 'bg-amber-900/30 border-amber-700 text-amber-200',
};

/**
 * One listing: photo, morphs, sex and age, asking price, and where the
 * price sits among similar geckos. The whole card opens the listing on
 * the marketplace it came from.
 */
export default function ListingCard({ listing, meta = null, badge = null, showBand = true }) {
  const {
    title, morphs, sex_class: sex, age_class: age, weight_grams: weight,
    price, was_price: wasPrice, price_position: pricePosition, position,
    similar_p25: p25, similar_p50: p50, similar_p75: p75,
    image_url: image, listing_url: url, currency, price_local: priceLocal,
  } = listing;
  const pos = pricePosition || position;
  const local = currency && currency !== 'USD' && Number(priceLocal) > 0
    ? `${Number(priceLocal).toLocaleString('en-US')} ${currency}`
    : null;
  const detail = [sexAgeLabel(sex, age), Number(weight) > 0 ? `${Math.round(weight)} g` : null]
    .filter(Boolean).join(', ');

  const body = (
    <div className="flex gap-3">
      <div className="w-20 h-20 shrink-0 overflow-hidden rounded-lg border border-slate-700 bg-slate-800">
        <GeckoImage src={image} alt={morphLabel(morphs, title || "Crested gecko")} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-100 truncate">{morphLabel(morphs, title || 'Crested gecko')}</p>
          <p className="text-sm font-bold text-slate-100 shrink-0">
            {Number(price) > 0 ? formatUsd(price) : ''}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-[11px] text-slate-500 truncate">{detail || title}</p>
          {Number(wasPrice) > 0 && (
            <p className="text-[11px] text-amber-300 shrink-0">cut from {formatUsd(wasPrice)}</p>
          )}
          {local && !wasPrice && <p className="text-[11px] text-slate-500 shrink-0">{local}</p>}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {badge}
          {pos && (
            <Badge variant="outline" className={`text-[10px] ${POSITION_STYLES[pos] || POSITION_STYLES.typical}`}>
              {positionLabel(pos)}
            </Badge>
          )}
          {meta && <span className="text-[11px] text-slate-500">{meta}</span>}
        </div>
        {showBand && <PriceBandBar price={price} p25={p25} p50={p50} p75={p75} compact />}
      </div>
    </div>
  );

  if (!url) {
    return <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">{body}</div>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-slate-800 bg-slate-900/60 p-3 hover:border-emerald-500/40 hover:bg-slate-900 transition-colors"
    >
      {body}
      <p className="mt-2 text-[10px] text-slate-600 group-hover:text-emerald-400 flex items-center gap-1">
        Open the listing <ExternalLink className="w-3 h-3" />
      </p>
    </a>
  );
}
