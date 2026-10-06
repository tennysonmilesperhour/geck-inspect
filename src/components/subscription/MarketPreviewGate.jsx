import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { canUseFeature } from '@/components/subscription/PlanLimitChecker';
import { getTierPricing } from '@/lib/stripe-config';
import { upgradePromptClicked, upgradePromptShown } from '@/lib/activation';
import { createPageUrl } from '@/utils';

/**
 * Market Intelligence is an Enterprise feature (decision 6 Oct 2026).
 * Everyone else sees a short, faded, read-only slice of the real panel
 * with an upgrade card on top: enough to see what it is, nothing they
 * can click, type into or scroll through.
 *
 * `inert` blocks clicks, focus and screen readers inside the preview.
 * React 18 does not know the attribute, so it is set on the node.
 */
export default function MarketPreviewGate({ user, surface, height = 360, children }) {
  const allowed = canUseFeature(user, 'market_intelligence');
  const previewRef = useRef(null);

  useEffect(() => {
    if (!allowed) upgradePromptShown('market_intelligence', surface);
  }, [allowed, surface]);

  useEffect(() => {
    previewRef.current?.setAttribute('inert', '');
  }, [allowed]);

  if (allowed) return children;

  const price = getTierPricing('enterprise', 'monthly');

  return (
    <div className="relative" style={{ minHeight: 320 }}>
      <div
        ref={previewRef}
        aria-hidden="true"
        className="overflow-hidden select-none pointer-events-none"
        style={{ maxHeight: height }}
      >
        {children}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-slate-950/80 to-slate-950" />
      <div className="absolute inset-x-0 bottom-0 flex justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-amber-500/40 bg-slate-900/95 p-5 text-center shadow-xl">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15">
            <Lock className="h-5 w-5 text-amber-400" />
          </div>
          <p className="font-semibold text-slate-100">Market Intelligence is part of Enterprise</p>
          <p className="mt-1 text-sm text-slate-400 leading-relaxed">
            The daily brief, the live feed of new listings and price cuts, watchlist alerts and the
            pricing analytics.{price ? ` ${price.price}${price.billing}, cancel anytime.` : ''}
          </p>
          <Button asChild className="mt-4 w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600">
            <Link
              to={createPageUrl('Membership')}
              onClick={() => upgradePromptClicked('market_intelligence', surface)}
            >
              See Enterprise <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
