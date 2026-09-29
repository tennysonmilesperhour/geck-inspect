import { TrendingUp } from 'lucide-react';
import { canUseFeature } from '@/components/subscription/PlanLimitChecker';
import { MARKET_INTELLIGENCE_URL } from '@/lib/constants';

// Topbar launcher for the standalone Market Intelligence (geck-data) app.
// Only renders for users whose effective tier unlocks `market_intelligence`
// (Enterprise + admins; grandfathered accounts stay on Breeder and don't
// get it, that's intentional per the pricing sheet).
//
// It used to poll <MARKET_INTELLIGENCE_URL>/api/unread-count?email=<email>
// every two minutes for a badge. The endpoint never existed, the request
// put the member's email address in a third-party URL, and the Content
// Security Policy flags it (it would be blocked once the policy is
// enforced, and the report stored the email). A plain link remains; if a
// badge comes back, fetch it server side, keyed by the signed-in session.
export default function MarketIntelligenceButton({ user }) {
  const canUse = canUseFeature(user, 'market_intelligence');

  if (!canUse) return null;

  return (
    <a
      href={MARKET_INTELLIGENCE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="gecko-header-action"
      aria-label="Open Market Intelligence in a new tab"
      title="Market Intelligence (opens in new tab)"
    >
      <TrendingUp />
    </a>
  );
}
