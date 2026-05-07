import { Link } from 'react-router-dom';
import { formatCents, fulfillmentBadge, isCartEligible } from '@/lib/store/format';
import { FtcDisclosureInline } from '@/components/store/FtcDisclosure';
import AddToCartButton from '@/components/store/AddToCartButton';

const TONE_CLASSES = {
  emerald: 'bg-emerald-500/10 text-emerald-300 border-emerald-700/40',
  sky: 'bg-sky-500/10 text-sky-300 border-sky-700/40',
  amber: 'bg-amber-500/10 text-amber-300 border-amber-700/40',
  slate: 'bg-slate-500/10 text-slate-300 border-slate-700/40',
};

export default function ProductCard({ product, vendorName }) {
  if (!product) return null;
  const primary =
    (Array.isArray(product.images) && product.images.find((i) => i.is_primary)) ||
    (Array.isArray(product.images) && product.images[0]) ||
    null;
  const cartEligible = isCartEligible(product.fulfillment_mode);
  const badge = fulfillmentBadge(product.fulfillment_mode, vendorName);

  const showAffiliate = product.fulfillment_mode === 'affiliate_redirect';

  return (
    <div className="group flex flex-col rounded-lg border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-colors overflow-hidden">
      <Link
        to={`/Store/p/${product.slug}`}
        className="block relative aspect-square bg-slate-950 overflow-hidden"
      >
        {primary ? (
          <img
            src={primary.url}
            alt={primary.alt || product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-700 text-xs">
            No image
          </div>
        )}
      </Link>
      <div className="p-3 flex flex-col flex-1 gap-2">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/Store/p/${product.slug}`} className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2">
              {product.name}
            </h3>
          </Link>
        </div>
        {product.short_description && (
          <p className="text-xs text-slate-400 line-clamp-2">
            {product.short_description}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-baseline gap-1.5">
            {cartEligible ? (
              <span className="text-base font-semibold text-emerald-200">
                {formatCents(product.our_price_cents)}
              </span>
            ) : (
              <span className="text-xs text-slate-400">See vendor for price</span>
            )}
            {product.compare_at_price_cents && product.compare_at_price_cents > product.our_price_cents && (
              <span className="text-[11px] text-slate-500 line-through">
                {formatCents(product.compare_at_price_cents)}
              </span>
            )}
          </div>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider rounded border px-1.5 py-0.5 ${
              TONE_CLASSES[badge.tone] || TONE_CLASSES.slate
            }`}
            title={badge.label}
          >
            {badge.tone === 'amber' ? 'Affiliate' : badge.tone === 'sky' ? 'Partner ship' : 'Geck Inspect'}
          </span>
        </div>
        <div className="mt-auto pt-2">
          <AddToCartButton product={product} compact />
          {showAffiliate && (
            <div className="mt-1.5">
              <FtcDisclosureInline />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
