import { TrendingUp } from 'lucide-react';
import { canUseFeature } from '@/components/subscription/PlanLimitChecker';
import { MARKET_INTELLIGENCE_URL } from '@/lib/constants';

// Topbar launcher for the standalone Market Intelligence (geck-data) app.
// Only renders for users whose effective tier unlocks `market_intelligence`
// (Enterprise + admins; grandfathered accounts stay on Breeder and don't
// get it — that's intentional per the pricing sheet).
export default function MarketIntelligenceButton({ user }) {
  if (!canUseFeature(user, 'market_intelligence')) return null;

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
