import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sparkles, CreditCard, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Modal that fires when a Free user tries to publish their 2nd post in a
// month. Three options:
//   1. Start a 30-day Keeper trial (recommended). Card required.
//      Auto-converts to Keeper $2.99/mo unless cancelled.
//   2. Add a card and keep posting at $0.50/post overage.
//   3. Upgrade now to a paid tier (skips the trial).
//
// In v1 the trial start button routes the user to /Membership where the
// existing Stripe Checkout flow handles trial setup. The Stripe Price for
// Keeper monthly already exists; the trial period needs to be configured
// in the dashboard or via the stripe-checkout edge function (see wrap-up
// notes for what's still needed there).
export default function TrialOfferModal({ open, onOpenChange, tier, trialAlreadyUsed }) {
  const [hovering, setHovering] = useState(null);
  const recommendTrial = !trialAlreadyUsed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">
            You've used your free post for this month
          </DialogTitle>
          <DialogDescription className="text-emerald-200/80">
            Pick how you'd like to keep going. The post you were drafting is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {recommendTrial && (
            <Link to={createPageUrl('Membership') + '?intent=keeper_trial'}>
              <button
                type="button"
                onMouseEnter={() => setHovering('trial')}
                onMouseLeave={() => setHovering(null)}
                className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                  hovering === 'trial'
                    ? 'border-emerald-400 bg-emerald-900/30'
                    : 'border-emerald-600/60 bg-emerald-900/20 hover:border-emerald-400'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-emerald-300" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-emerald-100">Try Keeper free for 30 days</span>
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200 font-bold">
                        Recommended
                      </span>
                    </div>
                    <p className="text-sm text-emerald-200/80 mb-2">
                      4 posts every month, full feature access, no charge for 30 days.
                    </p>
                    <p className="text-xs text-emerald-300/70">
                      $2.99/month after the trial. Cancel anytime, day-25 reminder email.
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-emerald-300 mt-1" />
                </div>
              </button>
            </Link>
          )}

          <Link to={createPageUrl('Settings') + '?tab=billing'}>
            <button
              type="button"
              onMouseEnter={() => setHovering('card')}
              onMouseLeave={() => setHovering(null)}
              className={`w-full text-left rounded-lg border p-4 transition-all ${
                hovering === 'card'
                  ? 'border-emerald-500/60 bg-emerald-900/20'
                  : 'border-emerald-800/40 bg-emerald-950/30 hover:border-emerald-600/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-700/20 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-emerald-300" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-emerald-100 mb-1">
                    Add a card, stay on Free
                  </div>
                  <p className="text-sm text-emerald-200/70">
                    $0.50 per post past your monthly free post. No subscription, no recurring charge.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-300/60 mt-1" />
              </div>
            </button>
          </Link>

          <Link to={createPageUrl('Membership')}>
            <button
              type="button"
              onMouseEnter={() => setHovering('upgrade')}
              onMouseLeave={() => setHovering(null)}
              className={`w-full text-left rounded-lg border p-4 transition-all ${
                hovering === 'upgrade'
                  ? 'border-emerald-500/60 bg-emerald-900/20'
                  : 'border-emerald-800/40 bg-emerald-950/30 hover:border-emerald-600/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-700/20 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4 text-emerald-300" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-emerald-100 mb-1">Upgrade to a paid tier</div>
                  <p className="text-sm text-emerald-200/70">
                    Skip the trial. See pricing for Keeper, Breeder, and Enterprise.
                  </p>
                </div>
              </div>
            </button>
          </Link>
        </div>

        <div className="text-xs text-emerald-200/50 text-center pt-2">
          {trialAlreadyUsed
            ? 'You have already used your one Keeper trial.'
            : tier === 'free' && 'Trial requires a payment method but no charge for the first 30 days.'}
        </div>
      </DialogContent>
    </Dialog>
  );
}
