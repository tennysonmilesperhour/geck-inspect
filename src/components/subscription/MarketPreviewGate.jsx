import { useEffect, useRef } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { canUseFeature } from '@/components/subscription/PlanLimitChecker';
import { getTierPricing } from '@/lib/stripe-config';
import { upgradePromptShown } from '@/lib/activation';
import UpgradePlansButton from '@/components/subscription/UpgradePlansButton';

/**
 * Market Intelligence is an Enterprise feature (decision 6 Oct 2026).
 * Everyone else sees a short, faded, read-only slice of the real panel
 * with an upgrade card on top: enough to see what it is, nothing they
 * can click, type into or scroll through.
 *
 * `inert` blocks clicks, focus and screen readers inside the preview.
 * React 18 does not know the attribute, so it is set on the node.
 *
 * `serverGated`: the panel's database functions refuse other plans too
 * (the brief, the live feed, watchlists and Business Tools market
 * analytics, since 15 Oct 2026), so the
 * real panel would only show its error state. Those surfaces get neutral
 * placeholder rows behind the upgrade card instead.
 */
function PlaceholderRows() {
  return (
    <div className="space-y-3 p-1">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <div className="h-12 w-12 shrink-0 rounded-md bg-slate-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 rounded bg-slate-800" />
            <div className="h-3 w-1/3 rounded bg-slate-800/70" />
          </div>
          <div className="h-4 w-14 rounded bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

export default function MarketPreviewGate({ user, surface, height = 360, serverGated = false, children }) {
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

  // The upgrade card is pinned to the bottom of the preview, so the
  // wrapper must be at least as tall as the card. On a phone its copy
  // wraps to more lines, so the floor is higher there.
  return (
    <div className="relative min-h-[420px] sm:min-h-[340px]">
      <div
        ref={previewRef}
        aria-hidden="true"
        className="overflow-hidden select-none pointer-events-none"
        style={{ maxHeight: height }}
      >
        {serverGated ? <PlaceholderRows /> : children}
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
          <UpgradePlansButton
            limitType="market_intelligence"
            surface={surface}
            trackShown={false}
            className="mt-4 w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600"
          >
            See Enterprise <ArrowRight className="ml-1 h-4 w-4" />
          </UpgradePlansButton>
        </div>
      </div>
    </div>
  );
}
